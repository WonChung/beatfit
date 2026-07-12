"use client";

import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setMessage(null);
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const result = mode === 'sign-in'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password });
    setLoading(false);
    if (result.error) {
      setError(result.error.message.toLowerCase().includes('invalid login credentials')
        ? 'Incorrect email or password.' : result.error.message);
      return;
    }
    if (result.data.session) {
      router.replace('/dashboard');
      router.refresh();
    } else {
      setMessage('Check your email to confirm your account.');
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">Music-powered movement</p>
        <h1 id="auth-title">BeatFit</h1>
        <p>{mode === 'sign-in' ? 'Sign in to build your next workout.' : 'Create an account to get moving.'}</p>
        <form onSubmit={submit} className="auth-form">
          <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input type="password" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {error ? <p className="api-error" role="alert">{error}</p> : null}
          {message ? <p className="auth-success" role="status">{message}</p> : null}
          <button className="primary-button" disabled={loading} type="submit">{loading ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Sign up'}</button>
        </form>
        <button className="text-button" type="button" onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError(null); setMessage(null); }}>
          {mode === 'sign-in' ? 'Create an account' : 'Already registered? Sign in'}
        </button>
      </section>
    </main>
  );
}
