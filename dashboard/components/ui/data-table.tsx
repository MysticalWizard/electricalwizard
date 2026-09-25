'use client';

import {
  flexRender,
  rowSortingFeature,
  tableFeatures,
  type RowData,
  type Table as TanstackTable,
} from '@tanstack/react-table';
import { cn } from '@/lib/utils';

// Features every DataTable relies on (header click-to-sort). Tables rendered
// here must be created with these features.
export const dataTableFeatures = tableFeatures({ rowSortingFeature });

interface DataTableProps<T extends RowData> {
  table: TanstackTable<typeof dataTableFeatures, T>;
}

export function DataTable<T extends RowData>({ table }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto border border-border rounded-lg">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-border bg-surface-alt">
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  onClick={h.column.getToggleSortingHandler()}
                  className={cn(
                    'px-3 py-2 text-left text-muted-foreground font-medium',
                    h.column.getCanSort() && 'cursor-pointer select-none',
                  )}
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {{ asc: ' ^', desc: ' v' }[
                    h.column.getIsSorted() as string
                  ] ?? ''}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-border hover:bg-surface-hover"
            >
              {row.getAllCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
