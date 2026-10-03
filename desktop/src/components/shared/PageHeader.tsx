import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  badge?: ReactNode;
  action?: { label: string; onClick: () => void; icon?: ReactNode };
  actions?: ReactNode;
  back?: { label: string; onClick: () => void };
  children?: ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  description,
  subtitle,
  badge,
  action,
  actions,
  back,
  children,
  className,
}: PageHeaderProps) {
  const desc = description || subtitle;
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 ${className || ""}`}>
      <div className="space-y-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          {back && (
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={back.onClick}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <h1 className="text-xl font-bold text-text-primary tracking-tight">{title}</h1>
          {badge && <div className="flex items-center">{badge}</div>}
        </div>
        {desc && <p className="text-xs text-text-secondary leading-relaxed max-w-2xl">{desc}</p>}
      </div>
      {(actions || action || children) && (
        <div className="flex items-center gap-2.5 flex-wrap">
          {children}
          {actions}
          {action && (
            <Button onClick={action.onClick} className="gap-1.5 h-9 rounded-xl font-medium shadow-xs" size="sm">
              {action.icon || <Plus className="h-3.5 w-3.5" />}
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
