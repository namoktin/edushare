import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { useApp } from '../store/AppContext';
import type { ResourceMeta } from '../lib/types';

export function PreviewModal({
  resource,
  onClose
}: {
  resource: ResourceMeta | null;
  onClose: () => void;
}) {
  const { getLocalBlob, download, verifyResource } = useApp();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    let revoke: string | null = null;
    let active = true;
    setUrl(null);
    setVerified(null);
    if (resource && resource.availability === 'local') {
      setLoading(true);
      void getLocalBlob(resource.resourceId).then((blob) => {
        if (!active || !blob) {
          setLoading(false);
          return;
        }
        const objectUrl = URL.createObjectURL(blob);
        revoke = objectUrl;
        setUrl(objectUrl);
        setLoading(false);
      });
      void verifyResource(resource.resourceId).then((v) => active && setVerified(v));
    }
    return () => {
      active = false;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [resource, getLocalBlob, verifyResource]);

  if (!resource) return null;

  return (
    <Modal open={!!resource} onClose={onClose} title={resource.title} wide>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="badge bg-brand-100 text-brand-700">{resource.subject}</span>
          <span className="badge bg-slate-100 text-slate-700">{resource.grade}</span>
          <span>{(resource.size / 1024 / 1024).toFixed(2)} MB</span>
          <span>· {resource.chunkCount} phần</span>
          {verified === true && <span className="badge bg-emerald-100 text-emerald-800">✓ Chữ ký hợp lệ</span>}
          {verified === false && <span className="badge bg-rose-100 text-rose-800">✗ Chữ ký không hợp lệ</span>}
        </div>

        {loading && <p className="text-sm text-slate-500">Đang mở từ bộ nhớ thiết bị…</p>}

        {url && <Viewer mime={resource.mime} title={resource.title} url={url} />}

        {!url && !loading && resource.availability !== 'local' && (
          <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            Tài nguyên chưa có trên thiết bị này. Bạn có thể tải từ mạng lớp về để xem ngoại tuyến.
            <div className="mt-3">
              <button className="btn-primary" onClick={() => void download(resource.resourceId)}>
                ⬇️ Tải về từ mạng lớp
              </button>
            </div>
          </div>
        )}

        <details className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
          <summary className="cursor-pointer font-medium text-slate-600">Thông tin kỹ thuật</summary>
          <p className="mt-2 break-all">ID: {resource.resourceId}</p>
          <p className="break-all">Merkle root: {resource.merkleRoot}</p>
          <p>Chủ sở hữu: {resource.ownerName} ({resource.ownerId})</p>
          <p>Kích thước phần: {(resource.chunkSize / 1024).toFixed(0)} KB</p>
        </details>
      </div>
    </Modal>
  );
}

function Viewer({ mime, title, url }: { mime: string; title: string; url: string }) {
  if (mime.startsWith('image/'))
    return <img src={url} alt={title} className="max-h-[60vh] w-full rounded-xl object-contain" />;
  if (mime.startsWith('video/'))
    return <video src={url} controls className="max-h-[60vh] w-full rounded-xl bg-black" />;
  if (mime.startsWith('audio/'))
    return <audio src={url} controls className="w-full" />;
  if (mime === 'application/pdf')
    return <iframe src={url} title={title} className="h-[65vh] w-full rounded-xl border border-slate-200" />;
  return (
    <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
      Định dạng <code>{mime}</code> không xem trước trực tiếp được.{' '}
      <a href={url} download={title} className="text-brand-700 underline">
        Tải xuống tệp
      </a>
    </div>
  );
}
