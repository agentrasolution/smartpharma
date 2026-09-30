import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface HourlyPoint {
  time: string;
  fullTime: string;
  mada: number;
  applePay: number;
  cash: number;
  insurance: number;
}

interface MoyasarAreaChartProps {
  data?: HourlyPoint[];
  currency?: string;
  filterStatus?: string;
}

function generateDefaultHourlyData(): HourlyPoint[] {
  const times = [
    { time: "02:00 PM", fullTime: "Today, 02:00 PM", mada: 380, applePay: 210, cash: 150, insurance: 80 },
    { time: "04:00 PM", fullTime: "Today, 04:00 PM", mada: 520, applePay: 340, cash: 220, insurance: 110 },
    { time: "06:00 PM", fullTime: "Today, 06:00 PM", mada: 890, applePay: 560, cash: 310, insurance: 190 },
    { time: "08:00 PM", fullTime: "Today, 08:00 PM", mada: 1420, applePay: 920, cash: 450, insurance: 310 },
    { time: "10:00 PM", fullTime: "Today, 10:00 PM", mada: 1850, applePay: 1180, cash: 620, insurance: 420 },
    { time: "12:00 AM", fullTime: "Today, 12:00 AM", mada: 1100, applePay: 740, cash: 390, insurance: 280 },
    { time: "02:00 AM", fullTime: "Today, 02:00 AM", mada: 420, applePay: 260, cash: 180, insurance: 90 },
    { time: "04:00 AM", fullTime: "Today, 04:00 AM", mada: 180, applePay: 120, cash: 70, insurance: 40 },
    { time: "06:00 AM", fullTime: "Today, 06:00 AM", mada: 310, applePay: 190, cash: 140, insurance: 80 },
    { time: "08:00 AM", fullTime: "Today, 08:00 AM", mada: 740, applePay: 480, cash: 290, insurance: 160 },
    { time: "10:00 AM", fullTime: "Today, 10:00 AM", mada: 1280, applePay: 820, cash: 440, insurance: 260 },
    { time: "12:00 PM", fullTime: "Today, 12:00 PM", mada: 1650, applePay: 1040, cash: 580, insurance: 370 },
  ];
  return times;
}

function CustomTooltip({ active, payload, label, currency = "SAR" }: any) {
  if (active && payload && payload.length) {
    const fullTime = payload[0]?.payload?.fullTime || label;
    return (
      <div className="bg-surface border border-border/80 rounded-xl shadow-xl p-3 min-w-[210px] text-xs select-none">
        <p className="font-semibold text-text-primary mb-2 border-b border-border/50 pb-1.5">{fullTime}</p>
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => {
            const labels: Record<string, string> = {
              mada: "Mada (Debit)",
              applePay: "Apple Pay",
              cash: "Cash In Hand",
              insurance: "Health Insurance",
            };
            const labelText = labels[entry.dataKey] || entry.name;
            return (
              <div key={`item-${index}`} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: entry.stroke || entry.color }}
                  />
                  <span className="text-text-secondary">{labelText}</span>
                </div>
                <span className="font-mono font-semibold text-text-primary">
                  {Number(entry.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
}

export default function MoyasarAreaChart({
  data,
  currency = "SAR",
  filterStatus = "all",
}: MoyasarAreaChartProps) {
  const chartData = useMemo(() => {
    return data && data.length > 0 ? data : generateDefaultHourlyData();
  }, [data]);

  return (
    <div className="w-full h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -10, bottom: 4 }}>
          <defs>
            <linearGradient id="moyasarBlue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="moyasarCyan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="moyasarEmerald" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0.01} />
            </linearGradient>
            <linearGradient id="moyasarPurple" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.01} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--color-border)"
            strokeOpacity={0.5}
          />

          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            axisLine={false}
            tickLine={false}
            dy={8}
          />

          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)}
          />

          <Tooltip content={<CustomTooltip currency={currency} />} />

          {(filterStatus === "all" || filterStatus === "mada") && (
            <Area
              type="monotone"
              dataKey="mada"
              name="mada"
              stroke="#3B82F6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#moyasarBlue)"
            />
          )}

          {(filterStatus === "all" || filterStatus === "applePay") && (
            <Area
              type="monotone"
              dataKey="applePay"
              name="applePay"
              stroke="#06B6D4"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#moyasarCyan)"
            />
          )}

          {(filterStatus === "all" || filterStatus === "cash") && (
            <Area
              type="monotone"
              dataKey="cash"
              name="cash"
              stroke="#10B981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#moyasarEmerald)"
            />
          )}

          {(filterStatus === "all" || filterStatus === "insurance") && (
            <Area
              type="monotone"
              dataKey="insurance"
              name="insurance"
              stroke="#8B5CF6"
              strokeWidth={1.5}
              fillOpacity={1}
              fill="url(#moyasarPurple)"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
