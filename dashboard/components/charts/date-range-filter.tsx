'use client';

interface DateRangeFilterProps {
  dateFrom: string;
  dateTo: string;
  groupBy: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onGroupByChange: (v: string) => void;
}

export function DateRangeFilter({
  dateFrom,
  dateTo,
  groupBy,
  onDateFromChange,
  onDateToChange,
  onGroupByChange,
}: DateRangeFilterProps) {
  return (
    <div className="flex gap-3 items-center flex-wrap">
      <label className="text-sm text-muted-foreground">
        From
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="ml-2 bg-surface border border-border rounded px-2 py-1 text-sm"
        />
      </label>
      <label className="text-sm text-muted-foreground">
        To
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="ml-2 bg-surface border border-border rounded px-2 py-1 text-sm"
        />
      </label>
      <label className="text-sm text-muted-foreground">
        Group by
        <select
          value={groupBy}
          onChange={(e) => onGroupByChange(e.target.value)}
          className="ml-2 bg-surface border border-border rounded px-2 py-1 text-sm"
        >
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
        </select>
      </label>
    </div>
  );
}
