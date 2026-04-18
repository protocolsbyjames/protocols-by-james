"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface VolumeDataPoint {
  date: string;
  volume: number; // total weight x reps
  sets: number;
}

interface StrengthChartProps {
  data: VolumeDataPoint[];
}

export function StrengthChart({ data }: StrengthChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border bg-background">
        <p className="text-sm text-muted-foreground">
          No workout data yet. Start logging your sets to see progress here.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickLine={false}
          axisLine={{ stroke: "#cbd5e1" }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickLine={false}
          axisLine={{ stroke: "#cbd5e1" }}
          unit=" lbs"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            fontSize: "13px",
          }}
          formatter={(value, name) => {
            const v = Number(value);
            if (name === "volume") return [`${v.toLocaleString()} lbs`, "Total Volume"];
            return [v, String(name)];
          }}
        />
        <Bar
          dataKey="volume"
          fill="#10b981"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
