import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export interface DonutBreakdownItem {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

interface MoyasarDonutCardProps {
  title: string;
  totalLabel: string;
  totalValue: string | number;
  items: DonutBreakdownItem[];
}

export default function MoyasarDonutCard({
  title,
  totalLabel,
  totalValue,
  items,
}: MoyasarDonutCardProps) {
  return (
    <div className="bg-surface border border-border/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
      {title && (
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-4">
          {title}
        </h4>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Ring Chart Container */}
        <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
          <PieChart width={144} height={144}>
            <Pie
              data={items}
              dataKey="value"
              cx={72}
              cy={72}
              innerRadius={46}
              outerRadius={64}
              paddingAngle={3}
              stroke="none"
            >
              {items.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>

          {/* Centered Stat Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
            <span className="text-[10px] text-text-secondary font-medium tracking-tight">
              {totalLabel}
            </span>
            <span className="text-sm font-bold text-text-primary tracking-tight mt-0.5">
              {typeof totalValue === "number" ? totalValue.toLocaleString() : totalValue}
            </span>
          </div>
        </div>

        {/* Legend & Breakdown Items */}
        <div className="flex-1 w-full space-y-2.5">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-text-secondary truncate text-xs font-medium">
                  {item.name}
                </span>
              </div>
              <span className="font-mono font-semibold text-text-primary text-xs pl-2">
                {item.percentage.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
