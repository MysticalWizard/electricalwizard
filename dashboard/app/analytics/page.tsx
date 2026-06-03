'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useModels, useAnalytics, useStats } from '@/api/hooks';
import { DateRangeFilter } from '@/components/charts/date-range-filter';
import { LineChart } from '@/components/charts/line-chart';
import { BarChart } from '@/components/charts/bar-chart';
import { PieChart } from '@/components/charts/pie-chart';

export default function AnalyticsPage() {
  const { data: models } = useModels();
  const { data: stats } = useStats();
  const [model, setModel] = useState('quotes');
  const [groupBy, setGroupBy] = useState('day');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: analytics } = useAnalytics(model, {
    groupBy,
    dateFrom,
    dateTo,
  });

  const pieData = stats
    ? Object.entries(stats as unknown as Record<string, unknown>)
        .filter(([k, v]) => !k.startsWith('active') && typeof v === 'number')
        .map(([name, value]) => ({
          name,
          value: value as number,
        }))
        .filter((d) => d.value > 0)
    : [];

  return (
    <AppShell>
      <h1 className="text-xl font-bold mb-4">Analytics</h1>

      <div className="flex gap-4 items-center mb-4 flex-wrap">
        <label className="text-sm text-muted-foreground">
          Model
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="ml-2 bg-surface border border-border rounded px-2 py-1 text-sm"
          >
            {models?.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          groupBy={groupBy}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onGroupByChange={setGroupBy}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LineChart data={analytics ?? []} title="Created Over Time" />
        <BarChart data={analytics ?? []} title={`Count by ${groupBy}`} />
        <PieChart data={pieData} title="Data Distribution" />
      </div>
    </AppShell>
  );
}
