'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createSSEConnection } from '@/api/sse';
import { useAuth } from './use-auth';

// Changes often arrive in bursts (e.g. the scheduler updating several
// records), so they're collected and invalidated together once per window.
const BATCH_MS = 300;

// Changes that don't alter record counts or the activity feed: daily
// translation counters and the bot's own status
const NOT_RECORDS = new Set(['translations', 'bots']);

export function useSSE() {
  const qc = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const changedModels = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      timer = null;
      if (changedModels.has('bots')) {
        qc.invalidateQueries({ queryKey: ['uptime'] });
      }
      let recordsChanged = false;
      for (const model of changedModels) {
        qc.invalidateQueries({ queryKey: ['documents', model] });
        qc.invalidateQueries({ queryKey: ['analytics', model] });
        if (!NOT_RECORDS.has(model)) recordsChanged = true;
      }
      changedModels.clear();
      if (recordsChanged) {
        qc.invalidateQueries({ queryKey: ['stats'] });
        qc.invalidateQueries({ queryKey: ['activity'] });
      }
    };

    const close = createSSEConnection((event) => {
      if (event.type === 'db:change') {
        changedModels.add(event.data.model);
        timer ??= setTimeout(flush, BATCH_MS);
      }
    });

    return () => {
      close();
      if (timer) clearTimeout(timer);
    };
  }, [qc, user]);
}
