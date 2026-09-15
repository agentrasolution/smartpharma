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

export default function StatCard({ title, value, icon, trend, subtitle, loading, delay = 0, href, onClick }: StatCardProps) {
  const numValue = typeof value === "number" ? value : 0;
  const isCurrency = title.toLowerCase().includes("revenue") || title.toLowerCase().includes("arrear");
  const animatedValue = useCountUp(numValue, 500);
  const isClickable = !!(href || onClick);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 space-y-2.5">
        <div className="h-3 w-20 bg-surface-2 rounded animate-pulse" />
        <div className="h-6 w-28 bg-surface-2 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
      whileHover={isClickable ? { y: -2, scale: 1.01 } : { y: -1 }}
      whileTap={isClickable ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={`group rounded-xl border border-border bg-surface p-4 relative overflow-hidden transition-all duration-200 ${
        isClickable ? "cursor-pointer hover:shadow-md hover:border-accent/30" : "hover:shadow-sm"
      }`}
    >
      <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent/20 group-hover:bg-accent transition-colors duration-200" />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-text-secondary tracking-wide uppercase">{title}</p>
          <div className="flex items-baseline gap-1.5">
            <p className="text-xl font-bold text-text-primary tabular-nums tracking-tight">
              {isCurrency ? formatCurrency(animatedValue) : animatedValue.toLocaleString()}
            </p>
            {typeof value === "number" && value !== animatedValue && (
              <span className="text-[9px] text-text-secondary animate-pulse">...</span>
            )}
          </div>
          {subtitle && <p className="text-[10px] text-text-secondary">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent group-hover:scale-105 group-hover:bg-accent/15 transition-all duration-200">
            {icon}
          </div>
          {isClickable && (
            <ArrowRight className="h-3.5 w-3.5 text-text-secondary/40 group-hover:text-accent group-hover:translate-x-0.5 transition-all duration-200" />
          )}
        </div>
      </div>
      {trend && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + 0.2 }}
          className="mt-3 flex items-center gap-1 text-[10px]"
        >
          {trend.positive ? (
            <TrendingUp className="h-3 w-3 text-success" />
          ) : (
            <TrendingDown className="h-3 w-3 text-danger" />
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
