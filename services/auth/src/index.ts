import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { z } from "zod";

const app = express();
const PORT = process.env.PORT || 3001;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const JWT_SECRET = process.env.JWT_SECRET || "arena-dev-secret";

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());
app.use(pinoHttp({ level: process.env.LOG_LEVEL || "info" }));

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "healthy", service: "auth", timestamp: new Date().toISOString() });
});

// Validate Supabase JWT and return user info
app.post("/validate", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.slice(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Fetch user profile and roles
    const { data: profile } = await supabase
      .from("profiles")
      .select("*, role_assignments(role_id, roles(name))")
      .eq("user_id", user.id)
      .single();

    const roles = profile?.role_assignments?.map((ra: { roles: { name: string } }) => ra.roles.name) || ["user"];

    // Generate internal service JWT
    const serviceToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        roles,
        subscription_tier: profile?.subscription_tier || "free",
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        handle: profile?.handle,
        display_name: profile?.display_name,
        avatar_url: profile?.avatar_url,
        subscription_tier: profile?.subscription_tier || "free",
        roles,
      },
      serviceToken,
    });
  } catch (err) {
    console.error("Validation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Verify internal service token
app.post("/verify", (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Token required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, payload: decoded });
  } catch (err) {
    res.status(401).json({ valid: false, error: "Invalid token" });
  }
});

// Get user profile by ID (internal service use)
app.get("/users/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*, role_assignments(role_id, roles(name))")
      .eq("user_id", userId)
      .single();

    if (error || !profile) {
      return res.status(404).json({ error: "User not found" });
    }

    const roles = profile.role_assignments?.map((ra: { roles: { name: string } }) => ra.roles.name) || ["user"];

    res.json({
      id: profile.user_id,
      handle: profile.handle,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      subscription_tier: profile.subscription_tier || "free",
      roles,
    });
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Check if user has required role
app.post("/authorize", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      userId: z.string().uuid(),
      requiredRoles: z.array(z.string()),
    });

    const { userId, requiredRoles } = schema.parse(req.body);

    const { data: assignments } = await supabase
      .from("role_assignments")
      .select("roles(name)")
      .eq("user_id", userId);

    const userRoles = assignments?.map((a: { roles: { name: string }[] }) => a.roles[0]?.name).filter(Boolean) || [];
    const hasRole = requiredRoles.some((r) => userRoles.includes(r));

    res.json({ authorized: hasRole, userRoles });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: err.issues });
    }
    console.error("Authorization error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Check subscription limits
app.post("/check-limit", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      userId: z.string().uuid(),
      action: z.enum(["battle_created", "api_call", "video_session", "tournament_created"]),
    });

    const { userId, action } = schema.parse(req.body);

    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("user_id", userId)
      .single();

    const tier = profile?.subscription_tier || "free";

    // Enterprise has no limits
    if (tier === "enterprise") {
      return res.json({ allowed: true, remaining: -1 });
    }

    // Pro has unlimited battles but limited API calls
    if (tier === "pro") {
      if (action === "battle_created" || action === "video_session") {
        return res.json({ allowed: true, remaining: -1 });
      }
    }

    // Check usage for free tier
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from("usage_tracking")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("event_type", action)
      .gte("created_at", startOfMonth.toISOString());

    const limits: Record<string, number> = {
      battle_created: 3,
      api_call: 1000,
      video_session: 0,
      tournament_created: 0,
    };

    const limit = limits[action] || 0;
    const used = count || 0;
    const remaining = Math.max(0, limit - used);

    res.json({ allowed: used < limit, remaining, limit, used });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: err.issues });
    }
    console.error("Check limit error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Auth service running on port ${PORT}`);
});
