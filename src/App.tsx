import { useEffect, useState } from 'react';
import { Menu, Moon, Search, Settings as SettingsIcon, Sun, X } from 'lucide-react';
import { NavLink, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import Dashboard from './pages/Dashboard';
import AddEntry from './pages/AddEntry';
import EntryDetail from './pages/EntryDetail';
import Auth from './pages/Auth';
import Plans from './pages/Plans';
import Reading from './pages/Reading';
import SettingsPage from './pages/Settings';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { Button } from './components/ui/button';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(isSupabaseConfigured);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

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
      <main className="grid min-h-screen place-items-center bg-stone-100 px-6 text-stone-950 dark:bg-stone-950 dark:text-stone-50">
        <section className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs uppercase tracking-[0.24em] text-stone-500">Setup needed</p>
          <h1 className="mt-2 text-2xl font-semibold text-stone-950">Connect Supabase</h1>
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
      <main className="grid min-h-screen place-items-center bg-stone-100 text-sm text-stone-500 dark:bg-stone-950 dark:text-stone-400">
        Loading account...
      </main>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-950 dark:bg-stone-950 dark:text-stone-50">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-stone-950/90">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-950 dark:text-stone-50">GUIDR</h1>
          </div>
          <nav className="flex items-center gap-2">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-stone-950 text-white dark:bg-stone-100 dark:text-stone-950'
                    : 'border border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950 dark:border-white/10 dark:text-stone-400 dark:hover:border-white/20 dark:hover:bg-white/[0.06] dark:hover:text-stone-50'
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
                    ? 'bg-stone-950 text-white dark:bg-stone-100 dark:text-stone-950'
                    : 'border border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950 dark:border-white/10 dark:text-stone-400 dark:hover:border-white/20 dark:hover:bg-white/[0.06] dark:hover:text-stone-50'
                }`
              }
            >
              Add Entry
            </NavLink>
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="w-9 px-0"
                aria-label="Open navigation menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((current) => !current)}
              >
                <Menu className="h-4 w-4" />
              </Button>
              {menuOpen ? (
                <div className="absolute right-0 top-11 z-20 grid min-w-36 gap-1 rounded-xl border border-stone-200 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-stone-950">
                  <NavLink
                    to="/plans"
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `rounded-lg px-3 py-2 text-sm font-medium transition ${
                        isActive
                          ? 'bg-stone-950 text-white dark:bg-stone-100 dark:text-stone-950'
                          : 'text-stone-600 hover:bg-stone-100 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-white/[0.06] dark:hover:text-stone-50'
                      }`
                    }
                  >
                    Plans
                  </NavLink>
                  <NavLink
                    to="/reading"
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `rounded-lg px-3 py-2 text-sm font-medium transition ${
                        isActive
                          ? 'bg-stone-950 text-white dark:bg-stone-100 dark:text-stone-950'
                          : 'text-stone-600 hover:bg-stone-100 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-white/[0.06] dark:hover:text-stone-50'
                      }`
                    }
                  >
                    Reading
                  </NavLink>
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-1">
              {searchOpen || searchQuery ? (
                <div className="flex h-9 items-center gap-2 rounded-full border border-stone-200 bg-white px-3 text-stone-700 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-stone-200">
                  <Search className="h-4 w-4 text-stone-400" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="w-44 bg-transparent text-sm outline-none placeholder:text-stone-400 dark:placeholder:text-stone-500"
                    placeholder="Search entries"
                    autoFocus
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      className="grid h-5 w-5 place-items-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-white/[0.08] dark:hover:text-stone-200"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-9 px-0"
                  aria-label="Search"
                  onClick={() => setSearchOpen(true)}
                >
                  <Search className="h-4 w-4" />
                </Button>
              )}
            </div>
            <NavLink to="/settings" aria-label="Settings">
              {({ isActive }) => (
                <Button
                  variant={isActive ? 'default' : 'ghost'}
                  size="sm"
                  className="w-9 px-0"
                  aria-label="Settings"
                >
                  <SettingsIcon className="h-4 w-4" />
                </Button>
              )}
            </NavLink>
            <Button
              variant="ghost"
              size="sm"
              className="w-9 px-0"
              aria-label={darkMode ? 'Use light mode' : 'Use dark mode'}
              onClick={() => setDarkMode((current) => !current)}
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void supabase.auth.signOut()}>
              Sign out
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1520px] px-6 py-10 sm:px-8 lg:px-10">
        <Routes>
          <Route path="/" element={<Dashboard searchQuery={searchQuery} />} />
          <Route path="/add" element={<AddEntry />} />
          <Route path="/edit/:id" element={<AddEntry />} />
          <Route path="/entry/:id" element={<EntryDetail />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/reading" element={<Reading />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
