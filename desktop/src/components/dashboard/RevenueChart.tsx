import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface RevenueChartProps {
  data?: { day: string; revenue: number }[];
  period?: "week" | "month";
}

function fillDays(data: { day: string; revenue: number }[], period: "week" | "month") {
  const days = period === "week" ? 7 : 30;
  const result: { label: string; revenue: number }[] = [];
  const map = new Map(data.map((d) => [d.day, d.revenue]));
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000);
    const key = date.toISOString().split("T")[0];
    const label =
      period === "week"
        ? date.toLocaleDateString("en-US", { weekday: "short" })
        : `${date.getMonth() + 1}/${date.getDate()}`;
    result.push({ label, revenue: map.get(key) ?? 0 });
  }
  return result;
}

export default function RevenueChart({ data = [], period = "week" }: RevenueChartProps) {
  const chartData = fillDays(data, period);

  return (
    <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval={period === "month" ? 4 : 0} />
          <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            formatter={(value: number) => [formatCurrency(value), "Revenue"]}
            labelStyle={{ fontWeight: 600, marginBottom: 4 }}
            contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
          />
          <Bar dataKey="revenue" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
