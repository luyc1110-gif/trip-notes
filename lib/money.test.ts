import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBalances,
  planTransfers,
  toMinor,
  toSettle,
  formatMoney,
  formatSigned,
} from './money.ts';

const ids = ['zheng', 'mei', 'ming', 'mom'];
const rates = { JPY: 0.21 };

// 設計稿上的京都五日示範資料
const kyoto = [
  { amountMinor: 6800, currency: 'JPY', payerId: 'zheng', participantIds: ids, isPersonal: false },
  { amountMinor: 1200, currency: 'JPY', payerId: 'mei', participantIds: ['mei'], isPersonal: true },
  { amountMinor: 3200, currency: 'JPY', payerId: 'ming', participantIds: ids, isPersonal: false },
  { amountMinor: 48000, currency: 'JPY', payerId: 'zheng', participantIds: ids, isPersonal: false },
  { amountMinor: 7200, currency: 'JPY', payerId: 'mom', participantIds: ids, isPersonal: false },
];

test('換算：日圓依旅程匯率換成台幣', () => {
  assert.equal(toSettle(6800, 'JPY', 'TWD', rates), 1428);
  assert.equal(toSettle(500, 'TWD', 'TWD', rates), 500);
  // 美元有兩位小數：US$12.50 × 32 = NT$400
  assert.equal(toSettle(1250, 'USD', 'TWD', { USD: 32 }), 400);
});

test('京都五日：淨額、每人旅費、總額與設計稿一致', () => {
  const b = computeBalances(ids, kyoto, [], 'TWD', rates);
  assert.equal(b.total, 13944);
  assert.deepEqual(b.net, { zheng: 8085, mei: -3423, ming: -2751, mom: -1911 });
  assert.deepEqual(b.cost, { zheng: 3423, mei: 3675, ming: 3423, mom: 3423 });
  assert.equal(Object.values(b.net).reduce((a, c) => a + c, 0), 0);
});

test('京都五日：三筆轉帳都付給小政', () => {
  const b = computeBalances(ids, kyoto, [], 'TWD', rates);
  const plan = planTransfers(b.net);
  assert.equal(plan.length, 3);
  assert.deepEqual(
    plan.map((t) => [t.fromId, t.toId, t.amountMinor]),
    [
      ['mei', 'zheng', 3423],
      ['ming', 'zheng', 2751],
      ['mom', 'zheng', 1911],
    ],
  );
});

test('標記已付後，該筆從待付方案消失；全部付清後方案為空', () => {
  const paid = [{ fromId: 'mom', toId: 'zheng', amountMinor: 1911 }];
  const b = computeBalances(ids, kyoto, paid, 'TWD', rates);
  assert.equal(b.net.mom, 0);
  assert.equal(planTransfers(b.net).length, 2);

  const allPaid = [
    ...paid,
    { fromId: 'mei', toId: 'zheng', amountMinor: 3423 },
    { fromId: 'ming', toId: 'zheng', amountMinor: 2751 },
  ];
  const done = computeBalances(ids, kyoto, allPaid, 'TWD', rates);
  assert.deepEqual(planTransfers(done.net), []);
});

test('除不盡的尾數由付款人吸收，淨額總和仍為零', () => {
  const b = computeBalances(
    ['a', 'b', 'c'],
    [{ amountMinor: 100, currency: 'TWD', payerId: 'a', participantIds: ['a', 'b', 'c'], isPersonal: false }],
    [],
    'TWD',
    {},
  );
  assert.deepEqual(b.net, { a: 66, b: -33, c: -33 });
  assert.deepEqual(b.cost, { a: 34, b: 33, c: 33 });
});

test('付款人不在分攤名單內也能正確計算', () => {
  const b = computeBalances(
    ['a', 'b', 'c'],
    [{ amountMinor: 101, currency: 'TWD', payerId: 'a', participantIds: ['b', 'c'], isPersonal: false }],
    [],
    'TWD',
    {},
  );
  assert.deepEqual(b.net, { a: 100, b: -50, c: -50 });
  assert.deepEqual(b.cost, { a: 1, b: 50, c: 50 });
});

test('多位債權人時，轉帳筆數不超過人數減一', () => {
  const plan = planTransfers({ a: 500, b: 300, c: -200, d: -600 });
  assert.ok(plan.length <= 3);
  const after: Record<string, number> = { a: 500, b: 300, c: -200, d: -600 };
  for (const t of plan) {
    after[t.fromId] += t.amountMinor;
    after[t.toId] -= t.amountMinor;
  }
  assert.deepEqual(after, { a: 0, b: 0, c: 0, d: 0 });
});

test('輸入解析與顯示格式', () => {
  assert.equal(toMinor('3,200', 'JPY'), 3200);
  assert.equal(toMinor('12.5', 'USD'), 1250);
  assert.equal(toMinor('abc', 'JPY'), null);
  assert.equal(toMinor('', 'JPY'), null);
  assert.equal(formatMoney(13944, 'TWD'), 'NT$13,944');
  assert.equal(formatMoney(1250, 'USD'), 'US$12.50');
  assert.equal(formatSigned(8085, 'TWD'), '+8,085');
  assert.equal(formatSigned(-3423, 'TWD'), '−3,423');
});
