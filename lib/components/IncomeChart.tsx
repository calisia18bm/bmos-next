"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type DataPoint = { month: string; income: number };

function formatCurrencyShort(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}rb`;
  return String(value);
}

export default function IncomeChart({ data }: { data: DataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD5" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "#7A746F" }}
          axisLine={{ stroke: "#E8DFD5" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#7A746F" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatCurrencyShort}
        />
        <Tooltip
          formatter={(value) =>
            new Intl.NumberFormat("id-ID", {
              style: "currency",
              currency: "IDR",
              maximumFractionDigits: 0,
            }).format(Number(value) || 0)
          }
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #E8DFD5",
            fontSize: 13,
          }}
        />
        <Bar dataKey="income" fill="#6E4B32" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
