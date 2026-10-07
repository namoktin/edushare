import { useApp } from '../store/AppContext';

export function StatusBar() {
  const { conn, peers, browserOnline, identity } = useApp();
  const dotColor =
    conn === 'online' ? 'bg-emerald-500' : conn === 'connecting' ? 'bg-amber-500' : 'bg-slate-400';
  const label =
    conn === 'online'
      ? `${peers.length} thiết bị đang kết nối trong lớp`
      : conn === 'connecting'
        ? 'Đang tìm thiết bị trong lớp…'
        : 'Chưa kết nối mạng lớp (vẫn xem được tài nguyên đã tải)';

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs">
      <span className={`inline-block h-2.5 w-2.5 animate-pulse rounded-full ${dotColor}`} />
      <span className="truncate text-slate-600">{label}</span>
      <span className="ml-auto flex items-center gap-2 whitespace-nowrap text-slate-400">
        <span title={browserOnline ? 'Có Internet' : 'Không có Internet'}>
          {browserOnline ? '🌐 Internet' : '📴 Ngoại tuyến'}
        </span>
        {identity && <span className="hidden sm:inline">· {identity.name}</span>}
      </span>
    </div>
  );
}
