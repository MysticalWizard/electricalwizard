'use client';

import {
  ResponsiveContainer,
  PieChart as RPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';

const COLORS = [
  '#5865f2',
  '#57f287',
  '#fee75c',
  '#ed4245',
  '#eb459e',
  '#949ba4',
];

interface PieChartProps {
  data: { name: string; value: number }[];
  title?: string;
}

export function PieChart({ data, title }: PieChartProps) {
  return (
    <div className="bg-surface-alt border border-border rounded-lg p-4">
      {title && <h3 className="text-sm text-muted-foreground mb-3">{title}</h3>}
      <ResponsiveContainer width="100%" height={250}>
        <RPieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ name, percent }: { name?: string; percent?: number }) =>
              `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
            }
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: '#2b2d31',
              border: '1px solid #3f4147',
              borderRadius: 8,
            }}
          />
          <Legend />
        </RPieChart>
      </ResponsiveContainer>
    </div>
  );
}
