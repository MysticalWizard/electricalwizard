'use client';

import {
  ResponsiveContainer,
  LineChart as RLineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface LineChartProps {
  data: { date: string; count: number }[];
  title?: string;
}

export function LineChart({ data, title }: LineChartProps) {
  return (
    <div className="bg-surface-alt border border-border rounded-lg p-4">
      {title && <h3 className="text-sm text-muted-foreground mb-3">{title}</h3>}
      <ResponsiveContainer width="100%" height={250}>
        <RLineChart data={data}>
          <CartesianGrid stroke="#3f4147" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: '#949ba4', fontSize: 12 }} />
          <YAxis tick={{ fill: '#949ba4', fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              background: '#2b2d31',
              border: '1px solid #3f4147',
              borderRadius: 8,
            }}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#5865f2"
            strokeWidth={2}
            dot={false}
          />
        </RLineChart>
      </ResponsiveContainer>
    </div>
  );
}
