import { redirect } from 'next/navigation';
import DashboardShell from '@/components/dashboard-shell';
import { shouldAllowDashboard } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!shouldAllowDashboard(Boolean(claims?.sub))) redirect('/?auth=required');
  return <DashboardShell
    email={typeof claims?.email === 'string' ? claims.email : 'Signed in'}
    userId={String(claims!.sub)}
  />;
}
