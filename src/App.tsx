import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import Dashboard from './pages/Dashboard';
import AddEntry from './pages/AddEntry';
import EntryDetail from './pages/EntryDetail';
import Auth from './pages/Auth';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { Button } from './components/ui/button';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <main className="grid min-h-screen place-items-center bg-stone-50 px-6">
        <section className="w-full max-w-lg rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-stone-400">Setup needed</p>
          <h1 className="mt-2 text-2xl font-semibold text-stone-900">Connect Supabase</h1>
          <p className="mt-3 text-sm text-stone-600">
            Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to a local `.env` file, then run
            the SQL in `supabase-schema.sql` in your Supabase project.
          </p>
        </section>
      </main>
    );
  }

  if (loadingSession) {
    return (
      <main className="grid min-h-screen place-items-center bg-stone-50 text-sm text-stone-500">
        Loading account...
      </main>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-stone-400">Since Timer</p>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
          </div>
          <nav className="flex items-center gap-2">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-stone-900 text-white'
                    : 'border border-stone-300 text-stone-600 hover:border-stone-400'
                }`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/add"
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-stone-900 text-white'
                    : 'border border-stone-300 text-stone-600 hover:border-stone-400'
                }`
              }
            >
              Add Entry
            </NavLink>
            <Button variant="ghost" size="sm" onClick={() => void supabase.auth.signOut()}>
              Sign out
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/add" element={<AddEntry />} />
          <Route path="/edit/:id" element={<AddEntry />} />
          <Route path="/entry/:id" element={<EntryDetail />} />
        </Routes>
      </main>
    </div>
  );
}
