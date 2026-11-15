import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlan, splitExisting } from './importPlan.ts';

const days = ['2026-11-30', '2026-12-01', '2026-12-02'];

test('完整五欄', () => {
  const { rows, errors } = parsePlan('2026-11-30 15:00 | 午餐：Suage+ 湯咖哩 | 餐廳 | 辣度可選 | Suage+ 本店 札幌', days);
  assert.equal(errors.length, 0);
  assert.deepEqual(rows[0], {
    line: 1, day: '2026-11-30', time: '15:00', name: '午餐：Suage+ 湯咖哩',
    category: 'food', note: '辣度可選', query: 'Suage+ 本店 札幌',
  });
});

test('日期可寫 月/日 或 D1，時間可省略並自動補零', () => {
  const { rows, errors } = parsePlan('12/1 9:05 | 小樽運河\nD3 | 青池 | 景點', days);
  assert.equal(errors.length, 0);
  assert.deepEqual(rows.map((r) => [r.day, r.time]), [['2026-12-01', '09:05'], ['2026-12-02', null]]);
});

test('類別預設景點，別名可用；搜尋字預設為名稱，- 代表不找位置', () => {
  const { rows } = parsePlan('D1 | 清水寺\nD1 | 起飛 | 航班 | | -\nD1 | 逛街 | 購物', days);
  assert.deepEqual(rows.map((r) => [r.category, r.query]), [['sight', '清水寺'], ['transit', null], ['shopping', '逛街']]);
});

test('空行與 # 開頭的行會略過，行號照原文', () => {
  const { rows } = parsePlan('# 第一天\n\nD1 | 甲', days);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].line, 3);
});

test('看不懂的行各自回報原因，不影響其他行', () => {
  const { rows, errors } = parsePlan(
    ['D1 | 好的', '沒有分隔', '12/25 | 範圍外', 'D1 25:00 | 時間錯', 'D1 | 類別錯 | 溫泉', 'D1 |', 'D9 | 超過天數'].join('\n'),
    days,
  );
  assert.equal(rows.length, 1);
  assert.deepEqual(errors.map((e) => e.line), [2, 3, 4, 5, 6, 7]);
  assert.match(errors[1].reason, /不在旅程期間內/);
  assert.match(errors[3].reason, /類別/);
});

test('同一天同名稱的視為已存在，同一批內重複也只留一筆', () => {
  const { rows } = parsePlan('D1 | 甲\nD1 | 乙\nD2 | 甲\nD1 | 乙', days);
  const { fresh, dup } = splitExisting(rows, [{ day: '2026-11-30', name: '甲' }]);
  assert.deepEqual(fresh.map((r) => `${r.day} ${r.name}`), ['2026-11-30 乙', '2026-12-01 甲']);
  assert.equal(dup.length, 2);
});
