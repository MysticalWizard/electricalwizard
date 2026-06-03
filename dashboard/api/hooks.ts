import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { api } from './client';
import type {
  ModelDef,
  PaginatedResponse,
  Stats,
  ActivityItem,
  AnalyticsPoint,
} from '@electricalwizard/shared';

export function useModels() {
  return useQuery({
    queryKey: ['models'],
    queryFn: () => api<ModelDef[]>('/api/models'),
    staleTime: Infinity,
  });
}

export function useDocuments(
  model: string,
  params: Record<string, string | number>,
) {
  return useQuery({
    queryKey: ['documents', model, params],
    queryFn: () => {
      const qs = new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)]),
      ).toString();
      return api<PaginatedResponse<Record<string, unknown>>>(
        `/api/${model}?${qs}`,
      );
    },
    placeholderData: keepPreviousData,
  });
}

export function useDocument(model: string, id: string) {
  return useQuery({
    queryKey: ['document', model, id],
    queryFn: () => api<Record<string, unknown>>(`/api/${model}/${id}`),
    enabled: !!id,
  });
}

export function useCreateDocument(model: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api(`/api/${model}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', model] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}

export function useUpdateDocument(model: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api(`/api/${model}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', model] });
      qc.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}

export function useDeleteDocument(model: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/${model}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', model] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => api<Stats>('/api/stats'),
  });
}

export function useActivity() {
  return useQuery({
    queryKey: ['activity'],
    queryFn: () => api<ActivityItem[]>('/api/activity'),
  });
}

export function useAnalytics(
  model: string,
  params: { groupBy: string; dateFrom?: string; dateTo?: string },
) {
  return useQuery({
    queryKey: ['analytics', model, params],
    queryFn: () => {
      const qs = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v) as [string, string][],
      ).toString();
      return api<AnalyticsPoint[]>(`/api/analytics/${model}?${qs}`);
    },
    enabled: !!model,
  });
}
