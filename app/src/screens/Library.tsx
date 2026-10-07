import { useMemo, useState } from 'react';
import { useApp } from '../store/AppContext';
import { ResourceCard } from '../components/ResourceCard';
import { PreviewModal } from '../components/PreviewModal';
import type { ResourceMeta } from '../lib/types';

export function Library() {
  const { catalog, download, removeResource, popularity, searchRemote } = useApp();
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState('Tất cả');
  const [grade, setGrade] = useState('Tất cả');
  const [selected, setSelected] = useState<ResourceMeta | null>(null);
  const [searching, setSearching] = useState(false);

  const subjects = useMemo(
    () => ['Tất cả', ...new Set(catalog.map((r) => r.subject).filter(Boolean))],
    [catalog]
  );
  const grades = useMemo(
    () => ['Tất cả', ...new Set(catalog.map((r) => r.grade).filter(Boolean))],
    [catalog]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return catalog
      .filter((r) => (subject === 'Tất cả' ? true : r.subject === subject))
      .filter((r) => (grade === 'Tất cả' ? true : r.grade === grade))
      .filter(
        (r) =>
          !needle ||
          r.title.toLowerCase().includes(needle) ||
          r.tags.some((t) => t.toLowerCase().includes(needle))
      )
      .sort((a, b) => (a.availability === 'local' ? -1 : 1) - (b.availability === 'local' ? -1 : 1));
  }, [catalog, q, subject, grade]);

  const remoteSearch = async () => {
    if (!q.trim()) return;
    setSearching(true);
    await searchRemote(q.trim());
    setSearching(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <input
            className="input pl-9"
            placeholder="Tìm tài nguyên theo tên, thẻ…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void remoteSearch()}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        </div>
        <button className="btn-ghost" onClick={() => void remoteSearch()} disabled={searching}>
          {searching ? 'Đang hỏi mạng lớp…' : '🌐 Tìm trên mạng lớp'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="input !w-auto" value={subject} onChange={(e) => setSubject(e.target.value)}>
          {subjects.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select className="input !w-auto" value={grade} onChange={(e) => setGrade(e.target.value)}>
          {grades.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card grid place-items-center gap-2 p-10 text-center">
          <span className="text-4xl">🗂️</span>
          <p className="text-sm text-slate-500">
            Chưa có tài nguyên. Hãy tải lên hoặc tìm trên mạng lớp.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((r) => (
            <ResourceCard
              key={r.resourceId}
              resource={r}
              popular={popularity[r.resourceId]}
              onOpen={() => setSelected(r)}
              onDownload={() => void download(r.resourceId)}
              onRemove={() => void removeResource(r.resourceId)}
            />
          ))}
        </div>
      )}

      <PreviewModal resource={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
