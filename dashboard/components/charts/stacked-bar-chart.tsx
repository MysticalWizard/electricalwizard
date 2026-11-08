'use client';

import {
  ResponsiveContainer,
  BarChart as RBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

export interface Series<T> {
  key: keyof T & string;
  label: string;
  color: string;
}

interface StackedBarChartProps<T extends { date: string }> {
  data: T[];
  /** Stacked bottom to top. */
  series: Series<T>[];
  title?: string;
}

export function StackedBarChart<T extends { date: string }>({
  data,
  series,
  title,
}: StackedBarChartProps<T>) {
  return (
    <div className="bg-surface-alt border border-border rounded-lg p-4">
      {title && <h3 className="text-sm text-muted-foreground mb-3">{title}</h3>}
      <ResponsiveContainer width="100%" height={250}>
        <RBarChart data={data}>
          <CartesianGrid stroke="#3f4147" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: '#949ba4', fontSize: 12 }} />
          <YAxis
            allowDecimals={false}
            tick={{ fill: '#949ba4', fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: '#35373c' }}
            contentStyle={{
              background: '#2b2d31',
              border: '1px solid #3f4147',
              borderRadius: 8,
            }}
          />
          <Legend />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={(row: T) => row[s.key]}
              name={s.label}
              stackId="stack"
              fill={s.color}
              radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
            />
          ))}
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
}
