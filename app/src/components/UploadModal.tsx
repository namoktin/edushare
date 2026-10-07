import { useState } from 'react';
import { Modal } from './Modal';
import { useApp } from '../store/AppContext';

const SUBJECTS = ['Toán', 'Ngữ văn', 'Tiếng Anh', 'Vật lý', 'Hóa học', 'Sinh học', 'Lịch sử', 'Địa lý', 'Tin học', 'Khác'];
const GRADES = ['Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9', 'Lớp 10', 'Lớp 11', 'Lớp 12', 'Chung'];

export function UploadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { publish, isAdmin, identity } = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [grade, setGrade] = useState(GRADES[3]);
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setFile(null);
    setTitle('');
    setTags('');
    setError('');
    setBusy(false);
  };

  const submit = async () => {
    if (!file) return setError('Vui lòng chọn tệp');
    setBusy(true);
    setError('');
    try {
      await publish({
        file,
        title: title || file.name,
        subject,
        grade,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      });
      reset();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="➕ Chia sẻ tài nguyên vào mạng lớp">
      <div className="space-y-4">
        {!file ? (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center hover:border-brand-500">
            <span className="text-4xl">📄</span>
            <span className="text-sm font-medium text-slate-700">Chạm để chọn tệp</span>
            <span className="text-xs text-slate-500">PDF, video, audio, ảnh, tài liệu…</span>
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ''));
              }}
            />
          </label>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
            <span className="text-2xl">📎</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
              <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button className="btn-ghost !px-3 !py-1.5" onClick={() => setFile(null)}>
              Đổi
            </button>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Tên tài nguyên</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Bài giảng Hóa 9 - Bài 4" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Môn học</label>
            <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Lớp</label>
            <select className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
              {GRADES.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Thẻ (phân cách bằng dấu phẩy)</label>
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ôn thi, bài tập, học kỳ 1" />
        </div>

        {isAdmin && (
          <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-700">
            🛡️ Bạn là Admin Node — metadata sẽ được ký HMAC khi phát hành.
          </p>
        )}
        {identity && !isAdmin && (
          <p className="text-xs text-slate-500">Tài nguyên sẽ được chia sẻ trực tiếp từ thiết bị của bạn.</p>
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onClose} disabled={busy}>
            Huỷ
          </button>
          <button className="btn-primary flex-1" onClick={submit} disabled={busy || !file}>
            {busy ? 'Đang chia sẻ…' : 'Chia sẻ vào mạng lớp'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
