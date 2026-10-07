import type { TransferJob } from '../lib/types';
import { ProgressBar } from './ProgressBar';
import { Badge } from './Badge';

const STATUS_LABEL: Record<TransferJob['status'], { text: string; color: 'slate' | 'emerald' | 'amber' | 'rose' | 'brand' }> = {
  queued: { text: 'Đang chờ', color: 'slate' },
  connecting: { text: 'Đang kết nối…', color: 'amber' },
  active: { text: 'Đang truyền', color: 'brand' },
  paused: { text: 'Tạm dừng', color: 'amber' },
  verifying: { text: 'Đang kiểm chứng', color: 'amber' },
  done: { text: 'Hoàn tất', color: 'emerald' },
  error: { text: 'Lỗi', color: 'rose' }
};

export function TransferRow({
  job,
  onPause,
  onResume
}: {
  job: TransferJob;
  onPause: () => void;
  onResume: () => void;
}) {
  const pct = job.totalBytes ? (job.transferredBytes / job.totalBytes) * 100 : 0;
  const st = STATUS_LABEL[job.status];
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">
            {job.direction === 'download' ? '⬇️' : '⬆️'} {job.title}
          </p>
          <p className="truncate text-xs text-slate-500">
            {job.direction === 'download' ? 'từ' : 'tới'} {job.peerName || job.peerId || 'mạng lớp'}
          </p>
        </div>
        <Badge color={st.color}>{st.text}</Badge>
      </div>

      <div className="mt-3">
        <ProgressBar value={pct} />
        <div className="mt-1.5 flex justify-between text-xs text-slate-500">
          <span>
            {job.receivedChunks}/{job.totalChunks} phần
          </span>
          <span>
            {pct.toFixed(0)}%
            {job.status === 'active' && job.speed > 0 ? ` · ${job.speed.toFixed(2)} MB/s` : ''}
          </span>
        </div>
      </div>

      {job.status === 'active' && (
        <button className="btn-ghost mt-3 w-full" onClick={onPause}>
          ⏸️ Tạm dừng
        </button>
      )}
      {(job.status === 'paused' || job.status === 'connecting') && (
        <button className="btn-primary mt-3 w-full" onClick={onResume}>
          ▶️ Tiếp tục
        </button>
      )}
      {job.status === 'error' && <p className="mt-2 text-xs text-rose-600">{job.error}</p>}
    </div>
  );
}
