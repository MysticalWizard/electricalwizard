'use client';

import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/api/client';
import { AuthProvider } from '@/context/auth-context';
import { useState, type ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [queryClient] = useState(() => {
    // Sessions can end mid-visit (expiry, logging out elsewhere, leaving the
    // server), so send the user back to sign in rather than leave a broken
    // page.
    const onError = (error: Error) => {
      if (error instanceof ApiError && error.status === 401) {
        router.replace('/login');
      }
    };
    return new QueryClient({
      queryCache: new QueryCache({ onError }),
      mutationCache: new MutationCache({ onError }),
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          retry: 1,
        },
      },
    });
  });

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
