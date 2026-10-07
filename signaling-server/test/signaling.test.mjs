// Kiểm thử chức năng signaling server: 2 peer cùng lớp trao đổi
// signal + advertise + query + rời phòng. Tự khởi động server trên cổng test.
//
// Chạy: npm test
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import WebSocket from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.TEST_PORT || 8790;
const room = 'test-room';

const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'ignore', 'inherit']
});

const results = [];
function ok(name, cond) {
  results.push([name, cond]);
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function connect(peerId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/?room=${room}&peerId=${peerId}`);
    const events = [];
    ws.on('message', (d) => events.push(JSON.parse(d.toString())));
    ws.on('open', () => resolve({ ws, events }));
    ws.on('error', reject);
  });
}

async function run() {
  // Chờ server sẵn sàng.
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (res.ok) break;
    } catch {
      /* chưa lên */
    }
    await sleep(100);
  }

  const a = await connect('peer-a');
  const b = await connect('peer-b');
  await sleep(300);

  ok('B có welcome', !!b.events.find((e) => e.type === 'welcome'));
  ok('A nhận peer-joined của B', !!a.events.find((e) => e.type === 'peer-joined' && e.peer.peerId === 'peer-b'));

  b.ws.send(JSON.stringify({ type: 'advertise', resource: { resourceId: 'r1', title: 'Hóa 9', subject: 'Hóa học', version: 1 } }));
  await sleep(300);
  ok('A nhận resource-advertise từ B', !!a.events.find((e) => e.type === 'resource-advertise' && e.resource.resourceId === 'r1'));

  a.ws.send(JSON.stringify({ type: 'query', requestId: 'q1', query: 'Hóa', ttl: 3 }));
  await sleep(300);
  const qr = a.events.find((e) => e.type === 'query-result' && e.requestId === 'q1');
  ok('A nhận query-result có tài nguyên r1', !!qr && qr.hits.some((h) => h.resource.resourceId === 'r1'));

  a.ws.send(JSON.stringify({ type: 'signal', to: 'peer-b', signal: { sdp: { type: 'offer', sdp: 'v=0' } } }));
  await sleep(300);
  const sig = b.events.find((e) => e.type === 'signal');
  ok('B nhận signal relay từ A', !!sig && sig.from === 'peer-a');

  b.ws.close();
  await sleep(300);
  ok('A nhận peer-left của B', !!a.events.find((e) => e.type === 'peer-left' && e.peerId === 'peer-b'));

  a.ws.close();
  const failed = results.filter(([, c]) => !c).length;
  console.log(`\n${results.length - failed}/${results.length} kiểm thử đạt`);
  return failed;
}

try {
  const failed = await run();
  server.kill();
  process.exit(failed ? 1 : 0);
} catch (e) {
  console.error(e);
  server.kill();
  process.exit(1);
}
