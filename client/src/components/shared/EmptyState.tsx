import { motion } from "framer-motion";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="h-12 w-12 rounded-xl bg-surface-2 flex items-center justify-center mb-3.5">
        <Inbox className="h-5 w-5 text-text-secondary" />
      </div>
      <h3 className="text-sm font-semibold text-text-primary mb-0.5">{title}</h3>
      {description && <p className="text-xs text-text-secondary max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}
