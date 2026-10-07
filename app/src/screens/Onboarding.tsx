import { useState } from 'react';
import { useApp } from '../store/AppContext';
import type { Role } from '../lib/types';

export function Onboarding() {
  const { join } = useApp();
  const [name, setName] = useState('');
  const [room, setRoom] = useState('lop-9a');
  const [role, setRole] = useState<Role>('learner');
  const [adminKey, setAdminKey] = useState('edushare-class-secret');

  const submit = () => {
    if (!name.trim()) return;
    join({ name, room, role, adminKey });
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-b from-brand-700 to-brand-900 p-4">
      <div className="card w-full max-w-md p-6">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-3xl">📚</div>
          <h1 className="text-2xl font-bold text-slate-800">EduShare</h1>
          <p className="mt-1 text-sm text-slate-500">
            Mạng lưới chia sẻ tài nguyên học tập ngoại tuyến trong lớp
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Tên thiết bị / của bạn</label>
            <input
              className="input"
              placeholder="VD: Máy của Minh"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Tên lớp (mã phòng)</label>
            <input className="input" value={room} onChange={(e) => setRoom(e.target.value)} />
            <p className="mt-1 text-xs text-slate-400">Các thiết bị cùng mã phòng sẽ thấy nhau trong mạng LAN.</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Vai trò</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                className={`btn ${role === 'learner' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setRole('learner')}
              >
                🎒 Học sinh
              </button>
              <button
                className={`btn ${role === 'admin' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setRole('admin')}
              >
                🛡️ Giáo viên
              </button>
            </div>
          </div>

          {role === 'admin' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Khoá ký của lớp (HMAC)</label>
              <input className="input" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} />
            </div>
          )}

          <button className="btn-primary w-full" onClick={submit} disabled={!name.trim()}>
            Tham gia lớp học
          </button>
          <p className="text-center text-xs text-slate-400">
            Hoạt động hoàn toàn ngoại tuyến sau lần tải đầu tiên
          </p>
        </div>
      </div>
    </div>
  );
}
