import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  actions?: ReactNode;
  back?: { label: string; onClick: () => void };
}

export default function PageHeader({ title, description, action, actions, back }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2.5">
          {back && (
            <Button variant="ghost" size="icon" onClick={back.onClick}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <h1 className="text-base font-semibold text-text-primary tracking-tight">{title}</h1>
        </div>
        {description && <p className="text-xs text-text-secondary">{description}</p>}
      </div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : action && (
        <Button onClick={action.onClick} className="gap-1.5" size="sm">
          <Plus className="h-3.5 w-3.5" />
          {action.label}
        </Button>
      )}
    </div>
  );
}
