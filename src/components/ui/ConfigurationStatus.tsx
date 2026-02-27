import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isSupabaseConfigured } from "@/lib/auth/config";

export function ConfigurationStatus() {
  if (isSupabaseConfigured) {
    return null; // Don't show anything if configured
  }

  return (
    <Card className="border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="bg-amber-100 text-amber-800">
          Configuration Required
        </Badge>
        <span className="text-amber-800 text-sm">
          Supabase is not configured. Please set up your environment variables to enable full functionality.
        </span>
      </div>
    </Card>
  );
}
