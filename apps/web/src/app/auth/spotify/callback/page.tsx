import { redirect } from 'next/navigation';
import SpotifyAuthCallback from '@/components/spotify-auth-callback';
import { createClient } from '@/lib/supabase/server';

export default async function SpotifyCallbackPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect('/?auth=required');
  return <SpotifyAuthCallback beatFitUserId={String(userId)} />;
}
