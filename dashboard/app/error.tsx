'use client';

import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center h-screen bg-surface">
      <div className="bg-surface-alt border border-border rounded-lg p-8 text-center max-w-md w-full">
        <h2 className="text-xl font-bold mb-2 text-destructive">
          Something went wrong
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <div className="flex gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => (window.location.href = '/')}
          >
            Go Home
          </Button>
          <Button onClick={reset}>Try Again</Button>
        </div>
      </div>
    </div>
  );
}
