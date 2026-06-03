'use client';

import {
  ResponsiveContainer,
  BarChart as RBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface BarChartProps {
  data: { date: string; count: number }[];
  title?: string;
  color?: string;
}

export function BarChart({ data, title, color = '#57f287' }: BarChartProps) {
  return (
    <div className="bg-surface-alt border border-border rounded-lg p-4">
      {title && <h3 className="text-sm text-muted-foreground mb-3">{title}</h3>}
      <ResponsiveContainer width="100%" height={250}>
        <RBarChart data={data}>
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
          <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
}
