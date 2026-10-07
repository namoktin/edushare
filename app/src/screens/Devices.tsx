import { useApp } from '../store/AppContext';
import { Badge } from '../components/Badge';

export function Devices() {
  const { peers, identity, isAdmin, leave, logs } = useApp();

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-2xl">
            {isAdmin ? '🛡️' : '🎒'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-800">
              {identity?.name} <span className="text-xs font-normal text-slate-400">(thiết bị này)</span>
            </p>
            <p className="truncate text-xs text-slate-500">
              Lớp: {identity?.room} · {isAdmin ? 'Admin Node (giáo viên)' : 'Learner Node (học sinh)'}
            </p>
          </div>
          {isAdmin && <Badge color="brand">Admin</Badge>}
        </div>
        <button className="btn-ghost mt-3 w-full text-rose-600" onClick={leave}>
          Rời khỏi lớp
        </button>
      </div>

      <div>
        <h2 className="mb-2 px-1 text-sm font-semibold text-slate-600">
          Thiết bị trong lớp ({peers.length})
        </h2>
        {peers.length === 0 ? (
          <div className="card grid place-items-center gap-2 p-8 text-center">
            <span className="text-4xl">👥</span>
            <p className="text-sm text-slate-500">
              Chưa thấy thiết bị khác. Hãy chắc chắn các máy cùng mạng Wi-Fi và cùng mã lớp.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {peers.map((p) => (
              <li key={p.peerId} className="card flex items-center gap-3 p-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-lg">
                  {p.role === 'admin' ? '🛡️' : '📱'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{p.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {p.resources.length > 0 ? `chia sẻ ${p.resources.length} tài nguyên` : 'chưa chia sẻ tài nguyên'}
                  </p>
                </div>
                <Badge color={p.connected ? 'emerald' : 'slate'}>
                  <span className={`inline-block h-2 w-2 rounded-full ${p.connected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  {p.connected ? 'P2P' : 'LAN'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-2 px-1 text-sm font-semibold text-slate-600">Nhật ký hoạt động</h2>
        <div className="card max-h-64 overflow-auto p-3">
          {logs.length === 0 ? (
            <p className="text-xs text-slate-400">Chưa có hoạt động.</p>
          ) : (
            <ul className="space-y-1 text-xs text-slate-500">
              {logs.map((l, i) => (
                <li key={i} className="border-b border-slate-50 pb-1 last:border-0">
                  {l}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
