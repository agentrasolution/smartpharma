"use client";
import { motion } from "framer-motion";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className || ""}`}
    >
      <div className="h-14 w-14 rounded-2xl bg-surface-2 border border-border/80 flex items-center justify-center mb-4 text-text-secondary shadow-xs">
        {icon || <Inbox className="h-6 w-6 stroke-[1.75]" />}
      </div>
      <h3 className="text-sm font-semibold text-text-primary tracking-tight mb-1">{title}</h3>
      {description && <p className="text-xs text-text-secondary max-w-sm mx-auto leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}
