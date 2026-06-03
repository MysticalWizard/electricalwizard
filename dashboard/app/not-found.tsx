import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center h-screen bg-surface">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-muted-foreground mb-2">404</h1>
        <p className="text-muted-foreground text-sm mb-6">
          This page could not be found.
        </p>
        <Button asChild>
          <Link href="/">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
