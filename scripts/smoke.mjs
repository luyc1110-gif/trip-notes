// 整合測試：對著本機開發伺服器把主要流程跑一遍。
// 用法：先啟動 npm run dev，再執行 node scripts/smoke.mjs [http://localhost:3210]
// 會建立一趟測試旅程，結束時刪除。只能用在開發環境（靠「開發模式登入」）。
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { computeBalances, planTransfers } from '../lib/money.ts';

const BASE = process.argv[2] ?? 'http://localhost:3210';
let passed = 0;

function client() {
  const jar = new Map();
  return async function call(path, { method = 'GET', body } = {}) {
    const res = await fetch(BASE + path, {
      method,
      redirect: 'manual',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      /* 非 JSON 回應 */
    }
    return { status: res.status, data };
  };
}

async function step(name, fn) {
  await fn();
  passed += 1;
  console.log(`✔ ${name}`);
}

const owner = client();
const mei = client();
const stranger = client();
let tripId;
let token;
let ids = {};
const act = (who, op) => who(`/api/trips/${tripId}/act`, { method: 'POST', body: op });
const snap = async (who) => (await who(`/api/trips/${tripId}`)).data;

await step('開發模式登入', async () => {
  const r = await owner('/api/auth/dev', { method: 'POST' });
  assert.equal(r.status, 303);
});

await step('未登入不能建立旅程', async () => {
  const r = await stranger('/api/trips', { method: 'POST', body: { name: 'x' } });
  assert.equal(r.status, 401);
});

await step('建立旅程，第一位成員是建立者且已認領', async () => {
  const r = await owner('/api/trips', {
    method: 'POST',
    body: {
      name: '整合測試之旅',
      startDate: '2027-03-18',
      endDate: '2027-03-22',
      settleCurrency: 'TWD',
      cover: 'town',
      memberNames: ['小政', '阿美', '小明', '媽媽'],
    },
  });
  assert.equal(r.status, 200);
  tripId = r.data.id;
  const s = await snap(owner);
  token = s.trip.inviteToken;
  assert.ok(token);
  assert.equal(s.me.role, 'owner');
  ids = Object.fromEntries(s.members.map((m) => [m.name, m.id]));
  assert.deepEqual(s.members.map((m) => m.claimed), [true, false, false, false]);
});

await step('沒有邀請 cookie 的人讀不到旅程', async () => {
  assert.equal((await stranger(`/api/trips/${tripId}`)).status, 401);
});

await step('建立者設定日圓匯率', async () => {
  const r = await act(owner, { op: 'currency.set', code: 'JPY', rate: 0.21 });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.currencies, [{ code: 'JPY', rate: 0.21 }]);
});

await step('同行者用邀請連結認領「阿美」', async () => {
  const r = await mei('/api/join', { method: 'POST', body: { token, memberId: ids['阿美'] } });
  assert.equal(r.status, 200);
  const s = await snap(mei);
  assert.equal(s.me.role, 'guest');
  assert.equal(s.me.memberId, ids['阿美']);
  assert.equal(s.trip.inviteToken, undefined, '同行者不該拿到邀請 token');
});

await step('已被認領的名字，別支手機不能再認領', async () => {
  const r = await stranger('/api/join', { method: 'POST', body: { token, memberId: ids['阿美'] } });
  assert.equal(r.status, 409);
  const o = await stranger('/api/join', { method: 'POST', body: { token, memberId: ids['小政'] } });
  assert.equal(o.status, 409, '建立者的名字不能被認領');
});

await step('同行者不能做建立者專屬的操作', async () => {
  for (const op of [
    { op: 'currency.set', code: 'USD', rate: 32 },
    { op: 'invite.reset' },
    { op: 'trip.delete' },
    { op: 'member.add', name: '路人' },
  ]) {
    assert.equal((await act(mei, op)).status, 403, op.op);
  }
});

const all = () => [ids['小政'], ids['阿美'], ids['小明'], ids['媽媽']];
const expense = (description, amountMinor, payer, extra = {}) => ({
  id: randomUUID(),
  description,
  amountMinor,
  currency: 'JPY',
  payerId: ids[payer],
  participantIds: all(),
  category: 'food',
  spentOn: '2027-03-19',
  isPersonal: false,
  ...extra,
});

await step('記五筆花費（建立者與同行者都能記），重送同一筆不會重複', async () => {
  const list = [
    expense('錦市場午餐', 6800, '小政'),
    expense('伏見稻荷御守', 1200, '阿美', { isPersonal: true, category: 'shopping' }),
    expense('地鐵一日券', 3200, '小明', { category: 'transit' }),
    expense('町家旅館 4 晚', 48000, '小政', { category: 'stay', spentOn: '2027-03-18' }),
    expense('關西機場特急', 7200, '媽媽', { category: 'transit', spentOn: '2027-03-18' }),
  ];
  for (const [i, e] of list.entries()) {
    const r = await act(i % 2 ? mei : owner, { op: 'expense.upsert', expense: e });
    assert.equal(r.status, 200, r.data?.error);
  }
  const again = await act(mei, { op: 'expense.upsert', expense: list[2] });
  assert.equal(again.status, 200);
  assert.equal(again.data.expenses.length, 5);
  const personal = again.data.expenses.find((e) => e.description === '伏見稻荷御守');
  assert.deepEqual(personal.participantIds, [ids['阿美']], '個人花費只會分給付款人自己');
});

await step('不合法的花費會被拒絕', async () => {
  const bad = [
    expense('零元', 0, '小政'),
    expense('沒設定的幣別', 100, '小政', { currency: 'USD' }),
    expense('沒有人分', 100, '小政', { participantIds: [] }),
    expense('外人付款', 100, '小政', { payerId: randomUUID() }),
  ];
  for (const e of bad) {
    assert.equal((await act(owner, { op: 'expense.upsert', expense: e })).status, 400, e.description);
  }
});

await step('餘額與設計稿一致：小政應收 8,085，其餘三人應付', async () => {
  const s = await snap(owner);
  const rates = Object.fromEntries(s.currencies.map((c) => [c.code, c.rate]));
  const b = computeBalances(s.members.map((m) => m.id), s.expenses, s.payments, 'TWD', rates);
  assert.equal(b.total, 13944);
  assert.equal(b.net[ids['小政']], 8085);
  assert.equal(b.net[ids['阿美']], -3423);
  assert.equal(b.net[ids['小明']], -2751);
  assert.equal(b.net[ids['媽媽']], -1911);
});

await step('行程：新增三個地點並重新排序', async () => {
  const base = { day: '2027-03-19', time: null, category: 'sight', note: '', placeId: null, lat: null, lng: null };
  await act(owner, { op: 'itinerary.add', item: { ...base, name: '伏見稻荷大社', time: '09:00', lat: 34.9671, lng: 135.7727 } });
  await act(mei, { op: 'itinerary.add', item: { ...base, name: '錦市場', time: '12:30', category: 'food' } });
  const r = await act(owner, { op: 'itinerary.add', item: { ...base, name: '清水寺', time: '15:00' } });
  assert.deepEqual(r.data.itinerary.map((i) => i.name), ['伏見稻荷大社', '錦市場', '清水寺']);
  const reversed = r.data.itinerary.map((i) => i.id).reverse();
  const after = await act(mei, { op: 'itinerary.reorder', day: '2027-03-19', ids: reversed });
  assert.deepEqual(after.data.itinerary.map((i) => i.name), ['清水寺', '錦市場', '伏見稻荷大社']);
  const out = await act(owner, { op: 'itinerary.add', item: { ...base, name: '範圍外', day: '2027-04-01' } });
  assert.equal(out.status, 400, '旅程期間以外的日期要被拒絕');
});

await step('待辦清單每個人各自獨立', async () => {
  const r = await act(owner, { op: 'todo.add', text: '換日幣' });
  assert.equal(r.data.todos.length, 1);
  assert.equal((await snap(mei)).todos.length, 0, '阿美看不到小政的待辦');
  const m = await act(mei, { op: 'todo.add', text: '買網卡' });
  const done = await act(mei, { op: 'todo.toggle', id: m.data.todos[0].id, done: true });
  assert.equal(done.data.todos[0].done, true);
  const other = await act(mei, { op: 'todo.toggle', id: r.data.todos[0].id, done: true });
  assert.equal(other.status, 200);
  assert.equal((await snap(owner)).todos[0].done, false, '不能勾別人的待辦');
});

await step('三筆轉帳都標記已付後，帳務自動鎖定', async () => {
  let s = await snap(owner);
  const rates = Object.fromEntries(s.currencies.map((c) => [c.code, c.rate]));
  const plan = planTransfers(computeBalances(s.members.map((m) => m.id), s.expenses, s.payments, 'TWD', rates).net);
  assert.equal(plan.length, 3);
  for (const t of plan) {
    const r = await act(mei, { op: 'payment.add', ...t });
    assert.equal(r.status, 200, r.data?.error);
    s = r.data;
  }
  s = await snap(owner);
  assert.equal(s.trip.locked, true);
  assert.equal(s.payments.length, 3);
});

await step('鎖定後不能再記帳，同行者也不能取消已付；建立者可以解鎖', async () => {
  const add = await act(mei, { op: 'expense.upsert', expense: expense('鎖定後的花費', 500, '阿美') });
  assert.equal(add.status, 409);
  const s = await snap(owner);
  assert.equal((await act(mei, { op: 'payment.remove', id: s.payments[0].id })).status, 409);
  assert.equal((await act(mei, { op: 'trip.unlock' })).status, 403);
  const unlocked = await act(owner, { op: 'trip.unlock' });
  assert.equal(unlocked.data.trip.locked, false);
});

await step('有紀錄的成員與幣別不能移除', async () => {
  assert.equal((await act(owner, { op: 'member.remove', id: ids['阿美'] })).status, 409);
  assert.equal((await act(owner, { op: 'currency.remove', code: 'JPY' })).status, 409);
  const added = await act(owner, { op: 'member.add', name: '臨時成員' });
  const temp = added.data.members.find((m) => m.name === '臨時成員');
  const removed = await act(owner, { op: 'member.remove', id: temp.id });
  assert.equal(removed.data.members.length, 4);
});

await step('重置邀請連結後，舊連結與舊 cookie 立即失效', async () => {
  const r = await act(owner, { op: 'invite.reset' });
  assert.notEqual(r.data.trip.inviteToken, token);
  assert.deepEqual(r.data.members.map((m) => m.claimed), [true, false, false, false]);
  assert.equal((await mei(`/api/trips/${tripId}`)).status, 401);
  const old = await stranger('/api/join', { method: 'POST', body: { token, memberId: ids['小明'] } });
  assert.equal(old.status, 404);
  const fresh = await mei('/api/join', { method: 'POST', body: { token: r.data.trip.inviteToken, memberId: ids['阿美'] } });
  assert.equal(fresh.status, 200);
  assert.equal((await mei(`/api/trips/${tripId}`)).status, 200);
});

await step('刪除旅程後所有人都讀不到', async () => {
  const r = await act(owner, { op: 'trip.delete' });
  assert.equal(r.status, 200);
  assert.equal((await owner(`/api/trips/${tripId}`)).status, 401);
  assert.equal((await mei(`/api/trips/${tripId}`)).status, 401);
});

console.log(`\n全部 ${passed} 個步驟通過`);
