import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoginLink } from './login-link';

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center h-screen bg-surface">
      <div className="bg-surface-alt border border-border rounded-lg p-8 text-center max-w-sm w-full">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Zap className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">ElectricalWizard</h1>
        </div>
        <p className="text-muted-foreground text-sm mb-6">
          Sign in with Discord to access the dashboard
        </p>
        <Button asChild>
          <LoginLink>Login with Discord</LoginLink>
        </Button>
      </div>
    </div>
  );
}
