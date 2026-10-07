import type { ResourceMeta } from '../lib/types';
import { AvailabilityBadge } from './Badge';

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ResourceCard({
  resource,
  onOpen,
  onDownload,
  onRemove,
  popular
}: {
  resource: ResourceMeta;
  onOpen: () => void;
  onDownload: () => void;
  onRemove?: () => void;
  popular?: number;
}) {
  const icon = iconFor(resource.mime);
  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-xl">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-slate-800" title={resource.title}>
            {resource.title}
          </h3>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {resource.subject} · {resource.grade} · {humanSize(resource.size)}
          </p>
        </div>
        {!!popular && popular > 1 && (
          <span className="badge bg-rose-100 text-rose-700" title="Độ phổ biến trong mạng">
            🔥 {popular}
          </span>
        )}
      </div>

      <AvailabilityBadge availability={resource.availability} />

      {resource.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {resource.tags.slice(0, 4).map((t) => (
            <span key={t} className="badge bg-slate-100 text-slate-600">
              #{t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex gap-2 pt-1">
        <button className="btn-primary flex-1" onClick={onOpen}>
          {resource.availability === 'local' ? 'Xem ngay' : 'Chi tiết'}
        </button>
        {resource.availability === 'network' && (
          <button className="btn-ghost" onClick={onDownload} title="Tải về từ mạng lớp">
            ⬇️ Tải
          </button>
        )}
        {resource.availability === 'local' && onRemove && (
          <button className="btn-ghost !px-3 text-rose-600" onClick={onRemove} title="Gỡ khỏi thiết bị">
            🗑️
          </button>
        )}
      </div>
    </div>
  );
}

function iconFor(mime: string): string {
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎧';
  if (mime === 'application/pdf') return '📕';
  if (mime.includes('zip')) return '🗜️';
  return '📄';
}
