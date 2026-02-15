import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ModerationConsolePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Moderation Console</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review queue + actions UI (skeleton).
        </p>
      </div>

      <Card className="border-border/60 bg-card/40 p-5 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Queue</div>
          <Badge variant="secondary">stub</Badge>
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          This page will be backed by `moderation_cases` + `moderation_actions`.
        </div>
      </Card>
    </div>
  );
}
