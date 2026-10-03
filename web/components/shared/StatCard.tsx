"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; positive: boolean };
  subtitle?: string;
  loading?: boolean;
  delay?: number;
  href?: string;
  onClick?: () => void;
  color?: "default" | "accent" | "success" | "warning" | "danger" | "purple";
  className?: string;
}

function useCountUp(end: number, duration = 500) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    let frame: number;

    function animate(timestamp: number) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * end));
      if (progress < 1) frame = requestAnimationFrame(animate);
    }

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [end, duration]);

  return count;
}

export default function StatCard({
  title,
  value,
  icon,
  trend,
  subtitle,
  loading,
  delay = 0,
  href,
  onClick,
  color = "default",
  className,
}: StatCardProps) {
  const numValue = typeof value === "number" ? value : 0;
  const isCurrency = typeof value === "number" && (title.toLowerCase().includes("revenue") || title.toLowerCase().includes("arrear") || title.toLowerCase().includes("cost") || title.toLowerCase().includes("profit") || title.toLowerCase().includes("value"));
  const animatedValue = useCountUp(numValue, 500);
  const isClickable = !!(href || onClick);

  const colorStyles = {
    default: { iconBg: "bg-accent/10 text-accent group-hover:bg-accent/15", border: "group-hover:border-accent/30", bar: "bg-accent/30 group-hover:bg-accent" },
    accent: { iconBg: "bg-accent/10 text-accent group-hover:bg-accent/15", border: "group-hover:border-accent/30", bar: "bg-accent/30 group-hover:bg-accent" },
    success: { iconBg: "bg-success/10 text-success group-hover:bg-success/15", border: "group-hover:border-success/30", bar: "bg-success/30 group-hover:bg-success" },
    warning: { iconBg: "bg-warning/10 text-warning group-hover:bg-warning/15", border: "group-hover:border-warning/30", bar: "bg-warning/30 group-hover:bg-warning" },
    danger: { iconBg: "bg-danger/10 text-danger group-hover:bg-danger/15", border: "group-hover:border-danger/30", bar: "bg-danger/30 group-hover:bg-danger" },
    purple: { iconBg: "bg-purple-500/10 text-purple-600 group-hover:bg-purple-500/15", border: "group-hover:border-purple-500/30", bar: "bg-purple-500/30 group-hover:bg-purple-500" },
  }[color];

  if (loading) {
    return (
      <div className={`rounded-2xl border border-border/80 bg-surface p-5 space-y-3 ${className || ""}`}>
        <div className="h-3 w-20 bg-surface-2 rounded-md animate-pulse" />
        <div className="h-7 w-28 bg-surface-2 rounded-md animate-pulse" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
      whileHover={isClickable ? { y: -2 } : undefined}
      whileTap={isClickable ? { scale: 0.99 } : undefined}
      onClick={onClick}
      className={`group rounded-2xl border border-border/80 bg-surface p-5 relative overflow-hidden transition-all duration-200 shadow-xs ${
        isClickable ? `cursor-pointer hover:shadow-md ${colorStyles.border}` : "hover:shadow-sm"
      } ${className || ""}`}
    >
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${colorStyles.bar} transition-colors duration-200`} />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-text-secondary tracking-wider uppercase">{title}</p>
          <div className="flex items-baseline gap-1.5">
            <p className="text-2xl font-bold text-text-primary tabular-nums tracking-tight font-mono">
              {typeof value === "string" ? value : isCurrency ? formatCurrency(animatedValue) : animatedValue.toLocaleString()}
            </p>
            {typeof value === "number" && value !== animatedValue && (
              <span className="text-[9px] text-text-secondary animate-pulse">...</span>
            )}
          </div>
          {subtitle && <p className="text-[11px] text-text-secondary">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-10 w-10 rounded-xl ${colorStyles.iconBg} flex items-center justify-center transition-all duration-200`}>
            {icon}
          </div>
          {isClickable && (
            <ArrowRight className="h-4 w-4 text-text-secondary/40 group-hover:text-accent group-hover:translate-x-0.5 transition-all duration-200" />
          )}
        </div>
      </div>
      {trend && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + 0.2 }}
          className="mt-3.5 flex items-center gap-1.5 text-[11px] pt-3 border-t border-border/50"
        >
          {trend.positive ? (
            <TrendingUp className="h-3.5 w-3.5 text-success" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-danger" />
          )}
          <span className={trend.positive ? "font-semibold text-success" : "font-semibold text-danger"}>
            {trend.value}%
          </span>
          <span className="text-text-secondary">vs last week</span>
        </motion.div>
      )}
    </motion.div>
  );
}
