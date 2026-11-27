import { useEffect, useState } from 'react';
import { Menu, Moon, Search, Settings as SettingsIcon, Sun, X } from 'lucide-react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import Dashboard from './pages/Dashboard';
import AddEntry from './pages/AddEntry';
import EntryDetail from './pages/EntryDetail';
import Auth from './pages/Auth';
import Plans from './pages/Plans';
import Reading from './pages/Reading';
import FinPlanner from './pages/FinPlanner';
import SettingsPage from './pages/Settings';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { Button } from './components/ui/button';
import QuoteRibbon from './components/QuoteRibbon';

export default function App() {
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(isSupabaseConfigured);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [today, setToday] = useState(() => new Date());
  const [menuOpenLocationKey, setMenuOpenLocationKey] = useState<string | null>(null);
  const menuOpen = menuOpenLocationKey === location.key;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const timeoutId = window.setTimeout(() => setToday(new Date()), Math.max(0, midnight.getTime() - Date.now()));

    return () => window.clearTimeout(timeoutId);
  }, [today]);

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

  const todayDateTime = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  return (
    <div className="min-h-screen bg-stone-100 text-stone-950 dark:bg-stone-950 dark:text-stone-50">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-stone-950/90">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
          <div className="flex w-full items-center justify-between sm:w-auto sm:justify-start sm:gap-4">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-950 dark:text-stone-50">GUIDR</h1>
            {location.pathname === '/' ? (
              <div
                className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1.5 dark:border-amber-400/20 dark:bg-amber-400/10"
                aria-label={`Today is ${new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(today)}`}
              >
                <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">Today</span>
                <span className="h-3 w-px bg-amber-300 dark:bg-amber-400/30" aria-hidden="true" />
                <time dateTime={todayDateTime} className="text-xs font-semibold text-stone-700 dark:text-stone-200">
                  {new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(today)}
                </time>
              </div>
            ) : null}
          </div>
          <nav className="flex w-full items-center justify-between gap-1.5 border-t border-stone-200 pt-2 sm:w-auto sm:justify-start sm:gap-2 sm:border-t-0 sm:pt-0 dark:border-white/10">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `rounded-full px-2.5 py-2 text-xs font-medium transition sm:px-4 sm:text-sm ${
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
                `rounded-full px-2.5 py-2 text-xs font-medium transition sm:px-4 sm:text-sm ${
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
                onClick={() => setMenuOpenLocationKey(menuOpen ? null : location.key)}
              >
                <Menu className="h-4 w-4" />
              </Button>
              {menuOpen ? (
                <div className="absolute right-0 top-11 z-20 grid min-w-36 gap-1 rounded-xl border border-stone-200 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-stone-950">
                  <NavLink
                    to="/goals"
                    onClick={() => setMenuOpenLocationKey(null)}
                    className={({ isActive }) =>
                      `rounded-lg px-3 py-2 text-sm font-medium transition ${
                        isActive
                          ? 'bg-stone-950 text-white dark:bg-stone-100 dark:text-stone-950'
                          : 'text-stone-600 hover:bg-stone-100 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-white/[0.06] dark:hover:text-stone-50'
                      }`
                    }
                  >
                    Goals
                  </NavLink>
                  <NavLink
                    to="/reading"
                    onClick={() => setMenuOpenLocationKey(null)}
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
                  <NavLink
                    to="/finplanner"
                    onClick={() => setMenuOpenLocationKey(null)}
                    className={({ isActive }) =>
                      `rounded-lg px-3 py-2 text-sm font-medium transition ${
                        isActive
                          ? 'bg-stone-950 text-white dark:bg-stone-100 dark:text-stone-950'
                          : 'text-stone-600 hover:bg-stone-100 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-white/[0.06] dark:hover:text-stone-50'
                      }`
                    }
                  >
                    FinPlanner
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
                    className="w-32 bg-transparent text-sm outline-none placeholder:text-stone-400 sm:w-44 dark:placeholder:text-stone-500"
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
            <Button className="hidden sm:inline-flex" variant="ghost" size="sm" onClick={() => void supabase.auth.signOut()}>
              Sign out
            </Button>
          </nav>
        </div>
        <QuoteRibbon />
      </header>

      <main className="mx-auto w-full max-w-[1520px] px-6 py-10 sm:px-8 lg:px-10">
        <Routes>
          <Route path="/" element={<Dashboard searchQuery={searchQuery} />} />
          <Route path="/add" element={<AddEntry />} />
          <Route path="/edit/:id" element={<AddEntry />} />
          <Route path="/entry/:id" element={<EntryDetail />} />
          <Route path="/goals" element={<Plans />} />
          <Route path="/reading" element={<Reading />} />
          <Route path="/finplanner" element={<FinPlanner />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
