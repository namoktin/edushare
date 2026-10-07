import { useApp } from '../store/AppContext';
import { TransferRow } from '../components/TransferRow';

export function Transfers() {
  const { transfers, pause, resume } = useApp();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-slate-600">Đang truyền ({transfers.length})</h2>
        <span className="badge bg-slate-100 text-slate-500">Tự động tiếp tục khi có mạng</span>
      </div>

      {transfers.length === 0 ? (
        <div className="card grid place-items-center gap-2 p-10 text-center">
          <span className="text-4xl">📡</span>
          <p className="text-sm text-slate-500">Chưa có phiên truyền nào.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {transfers.map((job) => (
            <TransferRow
              key={job.id}
              job={job}
              onPause={() => pause(job.id)}
              onResume={() => resume(job.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
