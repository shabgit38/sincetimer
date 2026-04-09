import { NavLink, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import AddEntry from './pages/AddEntry';
import EntryDetail from './pages/EntryDetail';

export default function App() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-stone-400">Since Timer</p>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
          </div>
          <nav className="flex gap-2">
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
