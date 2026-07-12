"use client";

import { useRouter } from 'next/navigation';
import WorkoutApp from '@/components/workout-app';
import { createClient } from '@/lib/supabase/client';

export default function DashboardShell({ email }: { email: string }) {
  const router = useRouter();
  async function signOut() {
    await createClient().auth.signOut();
    router.replace('/');
    router.refresh();
  }
  return (
    <>
      <div className="account-bar"><span>{email}</span><button type="button" onClick={signOut}>Sign out</button></div>
      <WorkoutApp />
    </>
  );
}
