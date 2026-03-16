import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function MaintenanceActionCard({ title, description, actionLabel, action }: { title: string; description: string; actionLabel: string; action: (formData: FormData) => void | Promise<void> }) {
  return (
    <Card className="space-y-3 p-4">
      <div>
        <p className="text-sm font-semibold text-text-institutional">{title}</p>
        <p className="text-xs text-text-neutral">{description}</p>
      </div>
      <form action={action} className="space-y-2">
        <label className="flex items-center gap-2 text-xs text-text-neutral">
          <input type="checkbox" required name="confirm" />
          Confirm this maintenance action.
        </label>
        <Button size="sm" variant="secondary" type="submit">
          {actionLabel}
        </Button>
      </form>
    </Card>
  );
}
