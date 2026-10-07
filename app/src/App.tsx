import { useState } from 'react';
import { useApp } from './store/AppContext';
import { Onboarding } from './screens/Onboarding';
import { Library } from './screens/Library';
import { Devices } from './screens/Devices';
import { Transfers } from './screens/Transfers';
import { StatusBar } from './components/StatusBar';
import { UploadModal } from './components/UploadModal';

type Tab = 'library' | 'devices' | 'transfers';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'library', label: 'Thư viện', icon: '📚' },
  { id: 'devices', label: 'Lớp học', icon: '👥' },
  { id: 'transfers', label: 'Đang truyền', icon: '⬆️' }
];

export default function App() {
  const { ready, identity, peers, transfers, isAdmin } = useApp();
  const [tab, setTab] = useState<Tab>('library');
  const [uploadOpen, setUploadOpen] = useState(false);

  if (!ready) {
    return (
      <div className="grid h-full place-items-center text-slate-500">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
          Đang khởi động EduShare…
        </div>
      </div>
    );
  }

  if (!identity) return <Onboarding />;

  const activeCount = transfers.filter((t) => t.status === 'active').length;

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Sidebar (laptop) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-2xl">📚</span>
          <div>
            <h1 className="text-lg font-bold leading-tight text-slate-800">EduShare</h1>
            <p className="text-[11px] text-slate-400">Lớp {identity.room}</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                tab === t.id ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="text-lg">{t.icon}</span>
              {t.label}
              {t.id === 'devices' && peers.length > 0 && (
                <span className="ml-auto badge bg-slate-100 text-slate-600">{peers.length}</span>
              )}
              {t.id === 'transfers' && activeCount > 0 && (
                <span className="ml-auto badge bg-brand-100 text-brand-700">{activeCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-3">
          <button className="btn-primary w-full" onClick={() => setUploadOpen(true)}>
            ➕ Tải tài nguyên lên
          </button>
          <p className="mt-2 truncate px-1 text-center text-[11px] text-slate-400">
            {isAdmin ? '🛡️ Admin Node' : '🎒'} · {identity.name}
          </p>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Header (mobile) */}
        <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-xl">📚</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold leading-none text-slate-800">EduShare</h1>
            <p className="text-[11px] text-slate-400">Lớp {identity.room}</p>
          </div>
          <button className="btn-ghost !px-3" onClick={() => setUploadOpen(true)} aria-label="Tải lên">
            ➕
          </button>
        </header>

        <div className="border-b border-slate-100 bg-white/70 backdrop-blur">
          <StatusBar />
        </div>

        <main className="min-h-0 flex-1 overflow-auto p-4 pb-24 lg:pb-6">
          <div className="mx-auto w-full max-w-6xl">
            {tab === 'library' && <Library />}
            {tab === 'devices' && <Devices />}
            {tab === 'transfers' && <Transfers />}
          </div>
        </main>

        {/* Tab bar (mobile) */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white lg:hidden">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                tab === t.id ? 'text-brand-700' : 'text-slate-500'
              }`}
            >
              <span className="relative text-xl">
                {t.icon}
                {t.id === 'transfers' && activeCount > 0 && (
                  <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[9px] text-white">
                    {activeCount}
                  </span>
                )}
              </span>
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* FAB (mobile) */}
      <button
        className="fixed bottom-20 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-brand-700 text-2xl text-white shadow-lg shadow-brand-900/20 active:scale-95 lg:hidden"
        onClick={() => setUploadOpen(true)}
        aria-label="Tải tài nguyên lên"
      >
        ➕
      </button>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}
