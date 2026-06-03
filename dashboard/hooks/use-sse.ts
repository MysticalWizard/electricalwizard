'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createSSEConnection } from '@/api/sse';
import { useAuth } from './use-auth';

export function useSSE() {
  const qc = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const cleanup = createSSEConnection((event) => {
      if (event.type === 'db:change') {
        const model = event.data.model as string;
        qc.invalidateQueries({ queryKey: ['documents', model] });
        qc.invalidateQueries({ queryKey: ['stats'] });
        qc.invalidateQueries({ queryKey: ['activity'] });
      }
    });
    return cleanup;
  }, [qc, user]);
}
