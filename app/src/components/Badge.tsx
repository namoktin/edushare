import type { ResourceAvailability } from '../lib/types';

export function AvailabilityBadge({ availability }: { availability?: ResourceAvailability }) {
  switch (availability) {
    case 'local':
      return <span className="badge bg-emerald-100 text-emerald-800">🟢 Có sẵn — xem ngay</span>;
    case 'network':
      return <span className="badge bg-amber-100 text-amber-800">🟡 Có trên mạng lớp — tải về</span>;
    default:
      return <span className="badge bg-slate-100 text-slate-600">⚪ Chưa có trong mạng</span>;
  }
}

export function Badge({
  children,
  color = 'slate'
}: {
  children: React.ReactNode;
  color?: 'slate' | 'emerald' | 'amber' | 'rose' | 'brand';
}) {
  const map: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700',
    emerald: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    rose: 'bg-rose-100 text-rose-800',
    brand: 'bg-brand-100 text-brand-700'
  };
  return <span className={`badge ${map[color]}`}>{children}</span>;
}
