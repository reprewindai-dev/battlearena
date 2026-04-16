import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabasePublicClient } from "@/lib/supabase/public";

const resetSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = resetSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    const supabase = createSupabasePublicClient();
    const origin = new URL(request.url).origin;
    
    const { error } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
      {
        redirectTo: `${origin}/update-password?next=/app/profile`,
      }
    );

    if (error) {
      // Don't reveal if email exists (security)
      console.error("Password reset error:", error.message);
      // Still return success to prevent email enumeration
    }

    // Always return success to prevent email enumeration attacks
    return NextResponse.json({
      ok: true,
      message: "If an account exists with this email, you will receive a password reset link.",
    });
  } catch (error) {
    console.error("Reset password route error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
