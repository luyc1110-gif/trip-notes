import { cookies } from 'next/headers';
import { q, isUuid } from './db';
import {
  getOwnerEmail,
  guestCookieName,
  newInviteToken,
  readGuestToken,
} from './auth';
import { CURRENCIES, computeBalances, planTransfers } from './money';
import { CATEGORIES, COVERS, PLACE_KINDS, type Op, type Snapshot } from './types';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function must(cond: unknown, status: number, message: string): asserts cond {
  if (!cond) throw new HttpError(status, message);
}

export type Actor = { role: 'owner' | 'guest'; memberId: string };

type TripRow = { id: string; invite_token: string };

/** 判斷目前的請求是誰：已登入的建立者，或持有有效邀請 cookie 的同行者 */
export async function resolveActor(tripId: string): Promise<Actor | null> {
  if (!isUuid(tripId)) return null;
  const [trip] = await q<TripRow>(
    'select id, invite_token from trips where id = $1 and deleted_at is null',
    [tripId],
  );
  if (!trip) return null;

  if (await getOwnerEmail()) {
    const [owner] = await q<{ id: string }>(
      'select id from members where trip_id = $1 and is_owner and deleted_at is null limit 1',
      [tripId],
    );
    return owner ? { role: 'owner', memberId: owner.id } : null;
  }

  const store = await cookies();
  const memberId = readGuestToken(
    store.get(guestCookieName(tripId))?.value,
    tripId,
    trip.invite_token,
  );
  if (!memberId || !isUuid(memberId)) return null;
  const [member] = await q<{ id: string }>(
    'select id from members where id = $1 and trip_id = $2 and deleted_at is null',
    [memberId, tripId],
  );
  return member ? { role: 'guest', memberId: member.id } : null;
}

const SNAPSHOT_SQL = `
select json_build_object(
  'trip', (
    select json_build_object(
      'id', t.id, 'name', t.name, 'startDate', t.start_date, 'endDate', t.end_date,
      'settleCurrency', t.settle_currency, 'cover', t.cover, 'locked', t.locked,
      'inviteToken', t.invite_token)
    from trips t where t.id = $1),
  'members', (
    select coalesce(json_agg(json_build_object(
      'id', m.id, 'name', m.name, 'color', m.color, 'isOwner', m.is_owner,
      'claimed', (m.claimed_at is not null or m.is_owner), 'sort', m.sort)
      order by m.sort, m.created_at), '[]'::json)
    from members m where m.trip_id = $1 and m.deleted_at is null),
  'currencies', (
    select coalesce(json_agg(json_build_object('code', c.code, 'rate', c.rate) order by c.code), '[]'::json)
    from trip_currencies c where c.trip_id = $1),
  'expenses', (
    select coalesce(json_agg(json_build_object(
      'id', e.id, 'description', e.description, 'amountMinor', e.amount_minor,
      'currency', e.currency, 'payerId', e.payer_id, 'participantIds', to_json(e.participant_ids),
      'category', e.category, 'spentOn', e.spent_on, 'isPersonal', e.is_personal,
      'createdBy', e.created_by)
      order by e.spent_on desc, e.created_at desc), '[]'::json)
    from expenses e where e.trip_id = $1 and e.deleted_at is null),
  'payments', (
    select coalesce(json_agg(json_build_object(
      'id', p.id, 'fromId', p.from_id, 'toId', p.to_id, 'amountMinor', p.amount_minor,
      'createdBy', p.created_by, 'createdAt', p.created_at)
      order by p.created_at), '[]'::json)
    from payments p where p.trip_id = $1 and p.deleted_at is null),
  'itinerary', (
    select coalesce(json_agg(json_build_object(
      'id', i.id, 'day', i.day, 'sort', i.sort, 'time', i.time, 'name', i.name,
      'category', i.category, 'note', i.note, 'placeId', i.place_id, 'lat', i.lat, 'lng', i.lng)
      order by i.day, i.sort, i.created_at), '[]'::json)
    from itinerary_items i where i.trip_id = $1 and i.deleted_at is null),
  'todos', (
    select coalesce(json_agg(json_build_object('id', d.id, 'text', d.text, 'done', d.done)
      order by d.created_at), '[]'::json)
    from todos d where d.trip_id = $1 and d.member_id = $2 and d.deleted_at is null)
) as snap`;

export async function getSnapshot(tripId: string, actor: Actor): Promise<Snapshot> {
  const [row] = await q<{ snap: unknown }>(SNAPSHOT_SQL, [tripId, actor.memberId]);
  const snap = (typeof row.snap === 'string' ? JSON.parse(row.snap) : row.snap) as Snapshot;
  snap.me = actor;
  // 資料庫的 numeric／bigint 在不同驅動下可能是字串，統一轉成數字
  snap.currencies = snap.currencies.map((c) => ({ code: c.code, rate: Number(c.rate) }));
  snap.expenses = snap.expenses.map((e) => ({ ...e, amountMinor: Number(e.amountMinor) }));
  snap.payments = snap.payments.map((p) => ({ ...p, amountMinor: Number(p.amountMinor) }));
  if (actor.role !== 'owner') delete snap.trip.inviteToken;
  return snap;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function text(v: unknown, max: number, label: string): string {
  must(typeof v === 'string', 400, `${label}格式不正確`);
  const s = v.trim();
  must(s.length > 0, 400, `請填寫${label}`);
  must(s.length <= max, 400, `${label}太長了`);
  return s;
}

function positiveInt(v: unknown, label: string): number {
  must(typeof v === 'number' && Number.isSafeInteger(v) && v > 0, 400, `${label}必須大於 0`);
  return v;
}

function outstandingTransfers(snap: Snapshot): number {
  const rates = Object.fromEntries(snap.currencies.map((c) => [c.code, c.rate]));
  const { net } = computeBalances(
    snap.members.map((m) => m.id),
    snap.expenses,
    snap.payments,
    snap.trip.settleCurrency,
    rates,
  );
  return planTransfers(net).length;
}

/** 執行一個操作；呼叫端之後再取最新的 snapshot 回傳給用戶端 */
export async function applyOp(tripId: string, actor: Actor, op: Op): Promise<void> {
  const snap = await getSnapshot(tripId, { role: 'owner', memberId: actor.memberId });
  const memberIds = new Set(snap.members.map((m) => m.id));
  const isOwner = actor.role === 'owner';
  const ownerOnly = () => must(isOwner, 403, '只有旅程建立者可以做這個操作');
  const notLocked = () =>
    must(!snap.trip.locked, 409, '帳務已結清並鎖定，請旅程建立者解鎖後再修改');

  switch (op.op) {
    case 'expense.upsert': {
      notLocked();
      const e = op.expense;
      must(isUuid(e.id), 400, '花費編號不正確');
      const description = text(e.description, 80, '說明');
      const amount = positiveInt(e.amountMinor, '金額');
      const currencyOk =
        e.currency === snap.trip.settleCurrency ||
        snap.currencies.some((c) => c.code === e.currency);
      must(currencyOk, 400, '這趟旅程還沒設定這個幣別的匯率');
      must(memberIds.has(e.payerId), 400, '付款人不在成員名單內');
      must(CATEGORIES.some((c) => c.key === e.category), 400, '類別不正確');
      must(DATE_RE.test(e.spentOn), 400, '日期格式不正確');
      const isPersonal = Boolean(e.isPersonal);
      const participants = isPersonal ? [e.payerId] : [...new Set(e.participantIds)];
      must(participants.length > 0, 400, '請至少選一位分攤的人');
      must(participants.every((p) => memberIds.has(p)), 400, '分攤名單有不在旅程內的成員');
      const [existing] = await q<{ trip_id: string }>(
        'select trip_id from expenses where id = $1',
        [e.id],
      );
      must(!existing || existing.trip_id === tripId, 409, '花費編號重複');
      await q(
        `insert into expenses
           (id, trip_id, description, amount_minor, currency, payer_id, participant_ids,
            category, spent_on, is_personal, created_by, updated_by)
         values ($1, $2, $3, $4, $5, $6,
           (select array_agg(x::uuid) from json_array_elements_text($7::json) as x),
           $8, $9::date, $10, $11, $11)
         on conflict (id) do update set
           description = excluded.description, amount_minor = excluded.amount_minor,
           currency = excluded.currency, payer_id = excluded.payer_id,
           participant_ids = excluded.participant_ids, category = excluded.category,
           spent_on = excluded.spent_on, is_personal = excluded.is_personal,
           updated_by = excluded.updated_by, updated_at = now(), deleted_at = null`,
        [
          e.id, tripId, description, amount, e.currency, e.payerId,
          JSON.stringify(participants), e.category, e.spentOn, isPersonal, actor.memberId,
        ],
      );
      return;
    }
    case 'expense.delete': {
      notLocked();
      must(isUuid(op.id), 400, '花費編號不正確');
      await q(
        'update expenses set deleted_at = now(), updated_by = $3 where id = $1 and trip_id = $2',
        [op.id, tripId, actor.memberId],
      );
      return;
    }
    case 'payment.add': {
      notLocked();
      must(memberIds.has(op.fromId) && memberIds.has(op.toId), 400, '成員不在旅程內');
      must(op.fromId !== op.toId, 400, '付款人與收款人不能相同');
      const amount = positiveInt(op.amountMinor, '金額');
      await q(
        `insert into payments (trip_id, from_id, to_id, amount_minor, created_by)
         values ($1, $2, $3, $4, $5)`,
        [tripId, op.fromId, op.toId, amount, actor.memberId],
      );
      // 全部付清後自動鎖定帳務
      const after = await getSnapshot(tripId, actor);
      if (after.expenses.length > 0 && outstandingTransfers(after) === 0) {
        await q('update trips set locked = true, updated_at = now() where id = $1', [tripId]);
      }
      return;
    }
    case 'payment.remove': {
      must(isUuid(op.id), 400, '轉帳編號不正確');
      must(!snap.trip.locked || isOwner, 409, '帳務已鎖定，請旅程建立者處理');
      await q(
        `with p as (update payments set deleted_at = now() where id = $1 and trip_id = $2 returning 1)
         update trips set locked = false, updated_at = now() where id = $2 and exists (select 1 from p)`,
        [op.id, tripId],
      );
      return;
    }
    case 'itinerary.add':
    case 'itinerary.update': {
      const it = op.item;
      const name = text(it.name, 80, '地點名稱');
      must(DATE_RE.test(it.day), 400, '日期格式不正確');
      must(it.day >= snap.trip.startDate && it.day <= snap.trip.endDate, 400, '日期不在旅程期間內');
      must(it.time === null || TIME_RE.test(it.time), 400, '時間格式不正確');
      must(PLACE_KINDS.some((k) => k.key === it.category), 400, '類別不正確');
      const note = typeof it.note === 'string' ? it.note.trim().slice(0, 200) : '';
      const hasPoint =
        typeof it.lat === 'number' && typeof it.lng === 'number' &&
        Math.abs(it.lat) <= 90 && Math.abs(it.lng) <= 180;
      const lat = hasPoint ? it.lat : null;
      const lng = hasPoint ? it.lng : null;
      const placeId = typeof it.placeId === 'string' ? it.placeId.slice(0, 300) : null;
      if (op.op === 'itinerary.add') {
        await q(
          `insert into itinerary_items
             (trip_id, day, sort, time, name, category, note, place_id, lat, lng, created_by, updated_by)
           values ($1, $2::date,
             (select coalesce(max(sort), 0) + 1 from itinerary_items
               where trip_id = $1 and day = $2::date and deleted_at is null),
             $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
          [tripId, it.day, it.time, name, it.category, note, placeId, lat, lng, actor.memberId],
        );
      } else {
        must(isUuid(op.id), 400, '行程編號不正確');
        await q(
          `update itinerary_items set day = $3::date, time = $4, name = $5, category = $6, note = $7,
             place_id = $8, lat = $9, lng = $10, updated_by = $11, updated_at = now()
           where id = $1 and trip_id = $2`,
          [op.id, tripId, it.day, it.time, name, it.category, note, placeId, lat, lng, actor.memberId],
        );
      }
      return;
    }
    case 'itinerary.delete': {
      must(isUuid(op.id), 400, '行程編號不正確');
      await q(
        'update itinerary_items set deleted_at = now(), updated_by = $3 where id = $1 and trip_id = $2',
        [op.id, tripId, actor.memberId],
      );
      return;
    }
    case 'itinerary.reorder': {
      must(Array.isArray(op.ids) && op.ids.every(isUuid), 400, '排序資料不正確');
      must(DATE_RE.test(op.day), 400, '日期格式不正確');
      await q(
        `update itinerary_items i set sort = o.ord, updated_by = $4, updated_at = now()
         from (select x.value::uuid as id, x.ordinality::int as ord
               from json_array_elements_text($3::json) with ordinality as x(value, ordinality)) o
         where i.id = o.id and i.trip_id = $1 and i.day = $2::date`,
        [tripId, op.day, JSON.stringify(op.ids), actor.memberId],
      );
      return;
    }
    case 'todo.add': {
      const t = text(op.text, 80, '待辦內容');
      await q('insert into todos (trip_id, member_id, text) values ($1, $2, $3)', [
        tripId, actor.memberId, t,
      ]);
      return;
    }
    case 'todo.toggle': {
      must(isUuid(op.id), 400, '待辦編號不正確');
      await q('update todos set done = $4 where id = $1 and trip_id = $2 and member_id = $3', [
        op.id, tripId, actor.memberId, Boolean(op.done),
      ]);
      return;
    }
    case 'todo.delete': {
      must(isUuid(op.id), 400, '待辦編號不正確');
      await q(
        'update todos set deleted_at = now() where id = $1 and trip_id = $2 and member_id = $3',
        [op.id, tripId, actor.memberId],
      );
      return;
    }
    case 'trip.update': {
      ownerOnly();
      const name = text(op.name, 40, '旅程名稱');
      must(DATE_RE.test(op.startDate) && DATE_RE.test(op.endDate), 400, '日期格式不正確');
      must(op.startDate <= op.endDate, 400, '結束日期不能早於開始日期');
      must(COVERS.some((c) => c.key === op.cover), 400, '封面不正確');
      await q(
        `update trips set name = $2, start_date = $3::date, end_date = $4::date, cover = $5,
           updated_at = now() where id = $1`,
        [tripId, name, op.startDate, op.endDate, op.cover],
      );
      return;
    }
    case 'trip.unlock': {
      ownerOnly();
      await q('update trips set locked = false, updated_at = now() where id = $1', [tripId]);
      return;
    }
    case 'trip.delete': {
      ownerOnly();
      await q('update trips set deleted_at = now() where id = $1', [tripId]);
      return;
    }
    case 'member.add': {
      ownerOnly();
      const name = text(op.name, 20, '成員名字');
      must(!snap.members.some((m) => m.name === name), 409, '已經有同名的成員');
      await q(
        `insert into members (trip_id, name, color, sort)
         select $1::uuid, $2::text, count(*)::int, count(*)::int + 1 from members where trip_id = $1::uuid`,
        [tripId, name],
      );
      return;
    }
    case 'member.rename': {
      ownerOnly();
      must(memberIds.has(op.id), 404, '找不到這位成員');
      const name = text(op.name, 20, '成員名字');
      must(!snap.members.some((m) => m.name === name && m.id !== op.id), 409, '已經有同名的成員');
      await q('update members set name = $3 where id = $1 and trip_id = $2', [op.id, tripId, name]);
      return;
    }
    case 'member.remove': {
      ownerOnly();
      const target = snap.members.find((m) => m.id === op.id);
      must(target, 404, '找不到這位成員');
      must(!target.isOwner, 400, '不能移除旅程建立者');
      const used =
        snap.expenses.some((e) => e.payerId === op.id || e.participantIds.includes(op.id)) ||
        snap.payments.some((p) => p.fromId === op.id || p.toId === op.id);
      must(!used, 409, '這位成員已經有花費或轉帳紀錄，無法移除');
      await q('update members set deleted_at = now() where id = $1 and trip_id = $2', [op.id, tripId]);
      return;
    }
    case 'member.unclaim': {
      ownerOnly();
      await q(
        'update members set claimed_at = null where id = $1 and trip_id = $2 and not is_owner',
        [op.id, tripId],
      );
      return;
    }
    case 'currency.set': {
      ownerOnly();
      must(typeof op.code === 'string' && op.code in CURRENCIES, 400, '不支援這個幣別');
      must(op.code !== snap.trip.settleCurrency, 400, '結算幣別不需要設定匯率');
      must(typeof op.rate === 'number' && op.rate > 0 && op.rate < 1e9, 400, '匯率必須大於 0');
      await q(
        `insert into trip_currencies (trip_id, code, rate) values ($1, $2, $3)
         on conflict (trip_id, code) do update set rate = excluded.rate`,
        [tripId, op.code, op.rate],
      );
      return;
    }
    case 'currency.remove': {
      ownerOnly();
      must(!snap.expenses.some((e) => e.currency === op.code), 409, '已經有花費使用這個幣別，無法移除');
      await q('delete from trip_currencies where trip_id = $1 and code = $2', [tripId, op.code]);
      return;
    }
    case 'invite.reset': {
      ownerOnly();
      await q(
        `with t as (update trips set invite_token = $2, updated_at = now() where id = $1 returning id)
         update members set claimed_at = null
         where trip_id = (select id from t) and not is_owner`,
        [tripId, newInviteToken()],
      );
      return;
    }
    default:
      throw new HttpError(400, '不支援的操作');
  }
}

export type TripSummary = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  cover: string;
  locked: boolean;
  memberCount: number;
};

export async function listTrips(): Promise<TripSummary[]> {
  const rows = await q<Record<string, unknown>>(
    `select t.id, t.name, to_char(t.start_date, 'YYYY-MM-DD') as start_date,
            to_char(t.end_date, 'YYYY-MM-DD') as end_date, t.cover, t.locked,
            (select count(*)::int from members m where m.trip_id = t.id and m.deleted_at is null) as member_count
     from trips t where t.deleted_at is null
     order by t.start_date desc, t.created_at desc`,
  );
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    startDate: String(r.start_date),
    endDate: String(r.end_date),
    cover: String(r.cover),
    locked: Boolean(r.locked),
    memberCount: Number(r.member_count),
  }));
}

export async function createTrip(input: {
  name: unknown;
  startDate: unknown;
  endDate: unknown;
  settleCurrency: unknown;
  cover: unknown;
  memberNames: unknown;
}): Promise<string> {
  const name = text(input.name, 40, '旅程名稱');
  must(
    typeof input.startDate === 'string' && typeof input.endDate === 'string' &&
      DATE_RE.test(input.startDate) && DATE_RE.test(input.endDate),
    400, '請選擇旅程日期',
  );
  must(input.startDate <= input.endDate, 400, '結束日期不能早於開始日期');
  must(typeof input.settleCurrency === 'string' && input.settleCurrency in CURRENCIES, 400, '結算幣別不正確');
  must(COVERS.some((c) => c.key === input.cover), 400, '封面不正確');
  must(Array.isArray(input.memberNames), 400, '成員名單格式不正確');
  const names = [...new Set(input.memberNames.map((n) => text(n, 20, '成員名字')))];
  must(names.length >= 1 && names.length <= 30, 400, '成員人數需在 1 到 30 人之間');

  // 第一位是建立者本人，直接視為已認領
  const [row] = await q<{ id: string }>(
    `with t as (
       insert into trips (name, start_date, end_date, settle_currency, cover, invite_token)
       values ($1, $2::date, $3::date, $4, $5, $6) returning id),
     m as (
       insert into members (trip_id, name, color, is_owner, claimed_at, sort)
       select t.id, x.name, x.ord::int - 1, x.ord = 1, case when x.ord = 1 then now() end, x.ord::int
       from t, json_array_elements_text($7::json) with ordinality as x(name, ord)
       returning 1)
     select id from t`,
    [name, input.startDate, input.endDate, input.settleCurrency, input.cover, newInviteToken(), JSON.stringify(names)],
  );
  return row.id;
}
