'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/hooks/use-auth';
import {
  useModels,
  useDocuments,
  useCreateDocument,
  useUpdateDocument,
  useDeleteDocument,
} from '@/api/hooks';
import { DataTable } from '@/components/ui/data-table';
import { SearchInput } from '@/components/ui/search-input';
import { Pagination } from '@/components/ui/pagination';
import { ModelForm } from '@/components/ui/model-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

type Doc = Record<string, unknown>;
const col = createColumnHelper<Doc>();

export default function ModelPage() {
  const params = useParams<{ model: string }>();
  const model = params.model;
  const { isAdmin, isOwner } = useAuth();
  const { data: models } = useModels();
  const modelDef = models?.find((m) => m.name === model);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<Doc | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<Doc | null>(null);

  useEffect(() => {
    setPage(1);
    setSearch('');
    setSorting([]);
    setCreateOpen(false);
    setEditDoc(null);
    setDeleteDoc(null);
  }, [model]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const sortField = sorting[0]?.id ?? 'createdAt';
  const sortOrder = sorting[0]?.desc === false ? 'asc' : 'desc';

  const { data } = useDocuments(model, {
    page,
    search,
    sortField,
    sortOrder,
  });
  const createMut = useCreateDocument(model);
  const updateMut = useUpdateDocument(model);
  const deleteMut = useDeleteDocument(model);

  const canWrite = modelDef?.readOnly
    ? false
    : modelDef?.ownerOnly
      ? isOwner
      : isAdmin;

  const columns = useMemo(() => {
    if (!modelDef) return [];

    const cols: ColumnDef<Doc, unknown>[] = modelDef.fields
      .filter((f) => f.name !== '__v')
      .slice(0, 6)
      .map((f) =>
        col.accessor((row) => row[f.name], {
          id: f.name,
          header: f.name,
          cell: (info) => {
            const val = info.getValue();
            if (val === null || val === undefined) return '-';
            if (f.type === 'date')
              return new Date(val as string).toLocaleString();
            if (f.type === 'boolean') return val ? 'Yes' : 'No';
            if (f.type === 'object') return JSON.stringify(val);
            const str = String(val);
            return str.length > 50 ? str.slice(0, 50) + '...' : str;
          },
        }),
      );

    if (canWrite) {
      cols.push(
        col.display({
          id: 'actions',
          header: '',
          cell: ({ row }) => (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setEditDoc(row.original)}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="xs"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteDoc(row.original)}
              >
                Delete
              </Button>
            </div>
          ),
        }),
      );
    }

    return cols;
  }, [model, modelDef, canWrite]);

  const table = useReactTable({
    data: data?.docs ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  });

  if (!modelDef)
    return (
      <AppShell>
        <div className="text-muted-foreground">Loading...</div>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold capitalize">{model}</h1>
        <div className="flex gap-3 items-center">
          <SearchInput value={search} onChange={setSearch} />
          {canWrite && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Create
            </Button>
          )}
        </div>
      </div>

      {modelDef.readOnly ? (
        <div className="bg-warning/10 text-warning border border-warning/30 rounded px-3 py-2 text-sm mb-4">
          This model is read-only and cannot be edited from the dashboard.
        </div>
      ) : modelDef.ownerOnly && !isOwner ? (
        <div className="bg-warning/10 text-warning border border-warning/30 rounded px-3 py-2 text-sm mb-4">
          This model is read-only. Only the bot owner can edit or delete
          entries.
        </div>
      ) : null}

      <DataTable table={table} />

      {data && (
        <div className="mt-4">
          <Pagination page={page} pages={data.pages} onPageChange={setPage} />
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create {model}</DialogTitle>
          </DialogHeader>
          <ModelForm
            fields={modelDef.fields}
            loading={createMut.isPending}
            onSubmit={(formData) => {
              createMut.mutate(formData, {
                onSuccess: () => setCreateOpen(false),
              });
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editDoc}
        onOpenChange={(open) => !open && setEditDoc(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {model}</DialogTitle>
          </DialogHeader>
          {editDoc && (
            <ModelForm
              fields={modelDef.fields}
              initial={editDoc}
              loading={updateMut.isPending}
              onSubmit={(formData) => {
                updateMut.mutate(
                  { id: String(editDoc._id), data: formData },
                  { onSuccess: () => setEditDoc(null) },
                );
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteDoc}
        onOpenChange={(open) => !open && setDeleteDoc(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this entry? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDoc(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteDoc) {
                  deleteMut.mutate(String(deleteDoc._id), {
                    onSuccess: () => setDeleteDoc(null),
                  });
                }
              }}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
