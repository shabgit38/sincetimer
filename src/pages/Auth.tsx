import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setSending(true);

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (signInError) {
      setError(signInError.message);
    } else {
      setStatus('Check your email for the sign-in link.');
    }

    setSending(false);
  };

  return (
    <main className="grid min-h-screen place-items-center bg-stone-50 px-6">
      <section className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-stone-400">GUIDR</p>
        <h1 className="mt-2 text-2xl font-semibold text-stone-900">Sign in</h1>
        <p className="mt-2 text-sm text-stone-500">
          Use the same account on phone, laptop, and browser.
        </p>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm font-medium text-stone-700" htmlFor="email">
            Email
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 rounded-lg border border-stone-300 bg-white px-4 text-sm text-stone-800 focus:border-stone-500 focus:outline-none"
              placeholder="you@example.com"
              required
            />
          </label>

          <button
            type="submit"
            disabled={sending}
            className="h-11 rounded-lg bg-stone-900 px-4 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-60"
          >
            {sending ? 'Sending...' : 'Send sign-in link'}
          </button>
        </form>

        {status ? <p className="mt-4 text-sm text-emerald-700">{status}</p> : null}
        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
      </section>
    </main>
  );
}
