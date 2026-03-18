import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type EventType = "battle_created" | "battle_participated" | "api_call" | "video_session" | "tournament_created";

export async function trackUsage(eventType: EventType, eventData: Record<string, unknown> = {}) {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) return;

    await fetch("/api/usage/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: eventType,
        event_data: eventData,
      }),
    });
  } catch (error) {
    console.error("Failed to track usage:", error);
  }
}

export async function checkUsageLimit(eventType: EventType): Promise<boolean> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) return false;

    const response = await fetch("/api/usage/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event_type: eventType }),
    });

    const data = await response.json();
    return data.allowed;
  } catch (error) {
    console.error("Failed to check usage limit:", error);
    return false;
  }
}
