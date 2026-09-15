import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";

const COLORS = ["var(--color-accent)", "var(--color-success)", "var(--color-warning)", "var(--color-danger)", "var(--color-border)"];

interface DonutChartProps {
  data?: { name: string; value: number }[];
}

export default function DonutChart({ data = [] }: DonutChartProps) {
  if (data.length === 0) {
    data = [{ name: "No data", value: 1 }];
  }

  return (
    <div className="h-50">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [formatCurrency(value), name]}
            contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
