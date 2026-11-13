'use client';

import { useMemo, useState } from 'react';
import {
  CURRENCIES,
  decimalsOf,
  formatAmount,
  formatMoney,
  formatSigned,
  planTransfers,
  symbolOf,
  toMinor,
  toSettle,
} from '@/lib/money';
import { CATEGORIES, type Expense, type Payment } from '@/lib/types';
import type { Ctx } from '../TripApp';
import { SkyBand } from '../Scenes';
import { useWidth } from '../timeline';
import { Avatar, Icon, longDate, md, todayIso, tripDays } from '../ui';

const catLabel = (key: string) => CATEGORIES.find((c) => c.key === key)?.label ?? '其他';
const catKey = (key: string) => (CATEGORIES.some((c) => c.key === key) ? key : 'other');

function OfflineBanner({ text }: { text: string }) {
  return (
    <div className="banner" role="status">
      <Icon name="offline" size={18} />
      {text}
    </div>
  );
}

function SubHeader({ title, meta, onBack, backLabel }: { title: string; meta: string; onBack: () => void; backLabel: string }) {
  return (
    <header className="band">
      <SkyBand />
      <div className="band-text with-back">
        <button className="icon-btn" aria-label={backLabel} onClick={onBack}>
          <Icon name="chevL" stroke={2.2} />
        </button>
        <div className="stack" style={{ gap: 4 }}>
          <h1 className="h1">{title}</h1>
          <div className="meta">{meta}</div>
        </div>
      </div>
    </header>
  );
}

// ── 記帳：上面是應收往上、應付往下的蹺蹺板，下面是一卷收據 ──────────

export function Expenses({ ctx }: { ctx: Ctx }) {
  const { snap, expenses, nav, balances, member, store, rates } = ctx;
  const { trip } = snap;
  const settle = trip.settleCurrency;
  const today = todayIso();
  const transfers = planTransfers(balances.net).length;
  const pendingCount = expenses.filter((e) => e.pending).length;
  // 點蹺蹺板上的頭像，收據只留那個人付的帳
  const [who, setWho] = useState<string | null>(null);
  const filter = who && snap.members.some((m) => m.id === who) ? who : null;

  const { groups, total } = useMemo(() => {
    const map = new Map<string, { list: Expense[]; sum: number }>();
    let sum = 0;
    for (const e of expenses) {
      if (filter && e.payerId !== filter) continue;
      const v = toSettle(e.amountMinor, e.currency, settle, rates);
      const g = map.get(e.spentOn) ?? { list: [], sum: 0 };
      g.list.push(e);
      g.sum += v;
      map.set(e.spentOn, g);
      sum += v;
    }
    return { groups: [...map.entries()], total: sum };
  }, [expenses, filter, rates, settle]);

  const maxNet = Math.max(1, ...snap.members.map((m) => Math.abs(balances.net[m.id] ?? 0)));
  const settleLabel = expenses.length === 0 ? '結算' : transfers === 0 ? '已全部結清' : `結算 ${transfers} 筆`;

  return (
    <div className="screen">
      <header className="band">
        <SkyBand />
        <div className="band-text">
          <h1 className="h1">記帳</h1>
          <div className="meta">
            {trip.name}・{snap.members.length} 人同行
          </div>
        </div>
      </header>
      {!store.online && <OfflineBanner text="目前離線，顯示的是上次同步的資料；仍然可以記一筆" />}

      <div className="body with-tabs" style={{ paddingTop: 6 }}>
        <div className="stack" style={{ gap: 0 }}>
          <div className="row spread">
            <h2 className="h2" style={{ fontSize: 16 }}>誰該收、誰該付</h2>
            <div className="row" style={{ gap: 14 }}>
              <button className="btn link" onClick={() => nav('stats')}>
                <Icon name="chart" size={18} />
                統計
              </button>
              <button className="btn link" onClick={() => nav('settle')}>
                {settleLabel}
                <Icon name="chevR" size={18} />
              </button>
            </div>
          </div>

          <div className="seesaw" role="group" aria-label="每人淨額。點一個人，下面只看他付的帳">
            {snap.members.map((m) => {
              const v = balances.net[m.id] ?? 0;
              const up = v >= 0;
              const h = v === 0 ? 0 : Math.max(6, Math.round((Math.abs(v) / maxNet) * 40));
              const on = filter === m.id;
              const amount = (
                <span className={`num ${v > 0 ? 'pos' : v < 0 ? 'neg' : 'muted'}`}>{formatSigned(v, settle)}</span>
              );
              return (
                <button
                  key={m.id}
                  className={`ss ${up ? 'up' : 'down'} ${on ? 'on' : filter ? 'dim' : ''}`}
                  aria-pressed={on}
                  aria-label={`${m.name}${v > 0 ? '應收' : v < 0 ? '應付' : '打平'} ${formatMoney(Math.abs(v), settle)}`}
                  onClick={() => setWho(on ? null : m.id)}
                >
                  <span className="ss-top">
                    {up ? (
                      <>
                        {amount}
                        <Avatar member={m} />
                        <i style={{ height: h }} />
                      </>
                    ) : (
                      <span className="ss-name">{m.name}</span>
                    )}
                  </span>
                  <span className="ss-bottom">
                    {up ? (
                      <span className="ss-name">{m.name}</span>
                    ) : (
                      <>
                        <i style={{ height: h }} />
                        <Avatar member={m} />
                        {amount}
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {trip.locked && (
          <p className="notice row">
            <Icon name="lock" size={20} />
            <span>帳務已全部結清並鎖定，無法再新增或修改花費。</span>
          </p>
        )}
        {pendingCount > 0 && (
          <div>
            <span className="pill sync">
              <Icon name="sync" size={14} stroke={2.2} />
              {pendingCount} 筆待同步，連上網路後會自動上傳
            </span>
          </div>
        )}

        {expenses.length === 0 ? (
          <p className="empty">還沒有任何花費。按下方的 ＋ 記第一筆。</p>
        ) : (
          <div className="tape">
            <div className="tape-body">
              {filter && (
                <div className="row spread">
                  <span className="sm">只看{member(filter).name}付的帳</span>
                  <button className="btn link" style={{ textDecoration: 'underline' }} onClick={() => setWho(null)}>
                    看全部
                  </button>
                </div>
              )}
              {groups.length === 0 && <p className="empty">{member(filter ?? '').name}還沒有付過任何一筆。</p>}

              {groups.map(([date, g]) => (
                <section key={date}>
                  <div className="tape-day">
                    <h2>
                      {longDate(date)}
                      {date === today ? '・今天' : ''}
                    </h2>
                    <span className="num-sm">{formatMoney(g.sum, settle)}</span>
                  </div>
                  {g.list.map((e) => {
                    const settleAmt = toSettle(e.amountMinor, e.currency, settle, rates);
                    const payer = member(e.payerId);
                    const split = e.isPersonal ? '個人花費' : `${e.participantIds.length} 人均分`;
                    return (
                      <button
                        key={e.id}
                        className={`tape-row ${e.pending ? 'pending' : ''}`}
                        onClick={() => (e.pending ? store.notify('這筆還在等待上傳，同步後才能修改') : nav('add', e.id))}
                      >
                        <span className="tape-line">
                          <span className={`tape-ico catc-${catKey(e.category)}`}>
                            <Icon name={catKey(e.category)} size={20} />
                          </span>
                          <span className="tape-name ellipsis">{e.description}</span>
                          <span className="leader" />
                          <span className="num">{formatMoney(e.amountMinor, e.currency)}</span>
                        </span>
                        <span className="tape-sub">
                          <span className="row" style={{ gap: 5, minWidth: 0 }}>
                            <Avatar member={payer} size="xs" />
                            <span className="ellipsis">
                              {payer.name}付・{split}
                              {e.pending ? '・待同步' : ''}
                            </span>
                          </span>
                          {e.currency !== settle && <span className="num-sm">{formatMoney(settleAmt, settle)}</span>}
                        </span>
                      </button>
                    );
                  })}
                </section>
              ))}

              <div className="tape-total">
                <span>{filter ? `${member(filter).name}一共先付了` : '旅程總花費'}</span>
                <span className="num">{formatMoney(total, settle)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 記一筆：不填表格，把一筆花費寫成一句話 ─────────────────────

type Picker = 'payer' | 'cur' | 'cat' | 'day' | null;

export function AddExpense({ ctx }: { ctx: Ctx }) {
  const { snap, route, nav, store, me, rates, member } = ctx;
  const { trip } = snap;
  const settle = trip.settleCurrency;
  const existing = route.id ? snap.expenses.find((e) => e.id === route.id) : undefined;
  const codes = [...new Set([...snap.currencies.map((c) => c.code), settle])];
  const allIds = snap.members.map((m) => m.id);
  const days = tripDays(trip.startDate, trip.endDate);
  const today = todayIso();
  const lastKey = `th:cur:${trip.id}`;

  const [currency, setCurrency] = useState(() => {
    if (existing) return existing.currency;
    let last: string | null = null;
    try {
      last = localStorage.getItem(lastKey);
    } catch {
      /* 略過 */
    }
    return last && codes.includes(last) ? last : codes[0];
  });
  const [amount, setAmount] = useState(
    existing ? formatAmount(existing.amountMinor, existing.currency).replace(/,/g, '') : '',
  );
  const [description, setDescription] = useState(existing?.description ?? '');
  const [spentOn, setSpentOn] = useState(existing?.spentOn ?? today);
  const [category, setCategory] = useState(existing?.category ?? 'food');
  const [payerId, setPayerId] = useState(existing?.payerId ?? me.id);
  const [participants, setParticipants] = useState<string[]>(
    existing ? (existing.isPersonal ? [existing.payerId] : existing.participantIds) : allIds,
  );
  const [picker, setPicker] = useState<Picker>(null);
  const [error, setError] = useState('');

  // 只分給付款人自己，就是不進分帳的個人花費
  const personal = participants.length === 1 && participants[0] === payerId;
  const minor = toMinor(amount, currency);
  const settleAmt = minor ? toSettle(minor, currency, settle, rates) : 0;
  const payer = member(payerId);

  let shareMain = '';
  let shareSub = '';
  if (!minor) shareMain = '先填金額';
  else if (participants.length === 0) shareMain = '至少選一個人';
  else if (personal) shareMain = '個人花費，不進分帳';
  else if (participants.length === 1) shareMain = `全部算${member(participants[0]).name}的`;
  else {
    const per = Math.floor(minor / participants.length);
    shareMain = `每人 ${formatMoney(per, currency)}`;
    shareSub = currency !== settle ? `約 ${formatMoney(toSettle(per, currency, settle, rates), settle)}` : '';
  }

  const toggle = (id: string) =>
    setParticipants((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const open = (p: Picker) => setPicker((cur) => (cur === p ? null : p));

  function choosePayer(id: string) {
    if (personal) setParticipants([id]);
    setPayerId(id);
    setPicker(null);
  }
  function tapCurrency() {
    if (codes.length > 2) return open('cur');
    setCurrency(codes[(codes.indexOf(currency) + 1) % codes.length]);
  }

  async function save() {
    if (!minor) return setError('請輸入大於 0 的金額');
    if (!description.trim()) return setError('請填寫買了什麼，例如「午餐」');
    if (!spentOn) return setError('請選擇日期');
    if (participants.length === 0) return setError('請至少選一位要分攤的人');
    setError('');
    try {
      localStorage.setItem(lastKey, currency);
    } catch {
      /* 略過 */
    }
    const result = await store.saveExpense(
      {
        id: existing?.id ?? crypto.randomUUID(),
        description: description.trim(),
        amountMinor: minor,
        currency,
        payerId,
        participantIds: participants,
        category,
        spentOn,
        isPersonal: personal,
      },
      !existing,
    );
    if (result === 'queued') store.notify('已先存在手機，連上網路後會自動上傳');
    if (result !== 'failed') nav('expenses');
  }

  async function remove() {
    if (!existing || !window.confirm(`確定要刪除「${existing.description}」嗎？`)) return;
    if (await store.act({ op: 'expense.delete', id: existing.id })) nav('expenses');
  }

  return (
    <div className="screen">
      <header className="row" style={{ gap: 4, padding: 'calc(6px + env(safe-area-inset-top)) 8px 0' }}>
        <button className="icon-btn" aria-label="關閉" onClick={() => nav('expenses')}>
          <Icon name="close" stroke={2.2} />
        </button>
        <h1 className="muted grow" style={{ fontSize: 18 }}>{existing ? '修改花費' : '記一筆'}</h1>
        {existing && (
          <button className="icon-btn" style={{ color: 'var(--orange)' }} aria-label="刪除這筆花費" onClick={remove} disabled={store.busy || trip.locked}>
            <Icon name="trash" />
          </button>
        )}
      </header>
      {!store.online && <OfflineBanner text="目前離線，會先存在手機，連線後自動上傳" />}
      {trip.locked && <OfflineBanner text="帳務已結清並鎖定，需要旅程建立者解鎖後才能儲存" />}

      <div className="sent">
        <div className="sent-row">
          <button className={`tok ${picker === 'payer' ? 'on' : ''}`} aria-expanded={picker === 'payer'} aria-label={`付款人：${payer.name}，點一下更換`} onClick={() => open('payer')}>
            <Avatar member={payer} />
            <span className="ellipsis">{payer.name}</span>
          </button>
          <span className="muted">付了</span>
        </div>

        <div className="stack" style={{ gap: 2 }}>
          <div className="sent-row" style={{ alignItems: 'flex-end' }}>
            {codes.length > 1 ? (
              <button
                className={`tok cur num ${picker === 'cur' ? 'on' : ''}`}
                aria-label={`幣別：${CURRENCIES[currency]?.name ?? currency}，點一下更換`}
                aria-expanded={codes.length > 2 ? picker === 'cur' : undefined}
                onClick={tapCurrency}
              >
                {symbolOf(currency)}
              </button>
            ) : (
              <span className="cur num">{symbolOf(currency)}</span>
            )}
            <label className="sr-only" htmlFor="exp-amount">金額</label>
            <input
              id="exp-amount"
              className="amount-input"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              style={{ width: `${Math.max(1, amount.length) + 0.4}ch` }}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
            />
          </div>
          <div className="num-sm sub" style={{ minHeight: 16 }}>
            {currency !== settle && minor
              ? `約 ${formatMoney(settleAmt, settle)}・匯率 ${rates[currency]}`
              : currency !== settle
                ? `匯率 ${symbolOf(currency)}1 = ${symbolOf(settle)}${rates[currency]}`
                : ''}
          </div>
        </div>

        <div className="sent-row">
          <span className="muted">買</span>
          <button className={`tok ${picker === 'cat' ? 'on' : ''}`} aria-expanded={picker === 'cat'} aria-label={`類別：${catLabel(category)}，點一下更換`} onClick={() => open('cat')}>
            {catLabel(category)}
          </button>
          <span className="muted">的</span>
          <label className="sr-only" htmlFor="exp-note">買了什麼</label>
          <input id="exp-note" className="sent-input" maxLength={80} placeholder="什麼東西" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="sent-row" style={{ alignItems: 'flex-start', paddingTop: 4 }}>
          <span className="muted" style={{ lineHeight: '48px' }}>分給</span>
          <div className="who" role="group" aria-label="誰要分攤">
            {snap.members.map((m) => {
              const on = participants.includes(m.id);
              return (
                <button key={m.id} className={`who-btn ${on ? '' : 'off'}`} aria-pressed={on} onClick={() => toggle(m.id)}>
                  <Avatar member={m} size="xl" />
                  <span className="ellipsis">{m.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="share" aria-live="polite">
          <span className="share-main num">{shareMain}</span>
          {shareSub && <span className="num-sm sub">{shareSub}</span>}
          <span className="grow" />
          {personal ? (
            <button className="btn link" onClick={() => setParticipants(allIds)}>改成大家分</button>
          ) : (
            <button className="btn link" onClick={() => setParticipants([payerId])}>只算{payer.name}的</button>
          )}
        </div>

        <div className="sent-row">
          <span className="muted">記在</span>
          <button className={`tok ${picker === 'day' ? 'on' : ''}`} aria-expanded={picker === 'day'} aria-label={`日期：${spentOn ? longDate(spentOn) : '未選'}，點一下更換`} onClick={() => open('day')}>
            <span className="num-sm">{spentOn ? md(spentOn) : '哪一天'}</span>
            {spentOn === today ? ' 今天' : ''}
          </button>
        </div>

        {picker === 'payer' && (
          <div className="tray">
            <div className="sub">誰先付的？</div>
            <div className="opts" role="group" aria-label="選擇付款人">
              {snap.members.map((m) => (
                <button key={m.id} className={`opt ${m.id === payerId ? 'on' : ''}`} aria-pressed={m.id === payerId} onClick={() => choosePayer(m.id)}>
                  <Avatar member={m} size="lg" />
                  <span className="ellipsis">{m.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {picker === 'cur' && (
          <div className="tray">
            <div className="sub">用哪種錢付的？</div>
            <div className="opts" role="group" aria-label="選擇幣別">
              {codes.map((c) => (
                <button
                  key={c}
                  className={`opt ${c === currency ? 'on' : ''}`}
                  aria-pressed={c === currency}
                  onClick={() => {
                    setCurrency(c);
                    setPicker(null);
                  }}
                >
                  <span className={`opt-dot num ${c === currency ? 'gold' : 'ring'}`}>{symbolOf(c)}</span>
                  <span className="ellipsis">{CURRENCIES[c]?.name ?? c}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {picker === 'cat' && (
          <div className="tray">
            <div className="sub">花在哪一類？</div>
            <div className="opts" role="group" aria-label="選擇類別">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  className={`opt ${c.key === category ? 'on' : ''}`}
                  aria-pressed={c.key === category}
                  onClick={() => {
                    setCategory(c.key);
                    setPicker(null);
                  }}
                >
                  <span className={`opt-dot cat-${c.key}`}>
                    <Icon name={c.key} size={22} />
                  </span>
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {picker === 'day' && (
          <div className="tray">
            <div className="sub">哪一天花的？</div>
            <div className="opts" role="group" aria-label="選擇日期">
              {days.map((d, i) => (
                <button
                  key={d}
                  className={`opt ${d === spentOn ? 'on' : ''}`}
                  aria-pressed={d === spentOn}
                  onClick={() => {
                    setSpentOn(d);
                    setPicker(null);
                  }}
                >
                  <span className={`opt-dot num ${d === spentOn ? 'gold' : 'ring'}`}>D{i + 1}</span>
                  <span className="num-sm">{d === today ? '今天' : md(d)}</span>
                </button>
              ))}
            </div>
            <div className="row" style={{ gap: 8 }}>
              <label className="sub" htmlFor="exp-date" style={{ flex: 'none' }}>旅程以外的日期</label>
              <input id="exp-date" className="input" type="date" style={{ height: 44 }} value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
            </div>
          </div>
        )}
        {error && <p className="neg sm" role="alert">{error}</p>}
      </div>

      <div className="hill-foot">
        <svg aria-hidden="true" viewBox="0 0 390 130" preserveAspectRatio="none">
          <path d="M0 130 L0 62 Q90 22 190 58 T390 40 L390 130 Z" fill="#9CCDB8" />
          <path d="M0 130 L0 92 Q110 56 220 94 T390 78 L390 130 Z" fill="#4F8A3C" />
        </svg>
        <button className="btn primary" onClick={save} disabled={store.busy || trip.locked}>
          {store.busy ? '儲存中…' : existing ? '存起來' : '記下來'}
        </button>
      </div>
    </div>
  );
}

// ── 結算：誰給誰畫成金流，粗細就是金額 ─────────────────────────

type Flow = { key: string; fromId: string; toId: string; amount: number; payment?: Payment };

const SL = 118; // 左邊（要付的人）每個人佔的高度
const SR = 220; // 右邊（要收的人）每個人佔的高度
const HEAD = 34;
const bez = (a: number, b: number, c: number, d: number, t: number) =>
  (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;

function FlowChart({ ctx, flows }: { ctx: Ctx; flows: Flow[] }) {
  const { snap, member, store, isOwner } = ctx;
  const settle = snap.trip.settleCurrency;
  const [ref, w] = useWidth<HTMLDivElement>();

  const rank = (id: string) => {
    const i = snap.members.findIndex((m) => m.id === id);
    return i < 0 ? 999 : i;
  };
  const uniq = (ids: string[]) => [...new Set(ids)].sort((a, b) => rank(a) - rank(b));
  const lefts = uniq(flows.map((x) => x.fromId));
  const rights = uniq(flows.map((x) => x.toId));
  const inner = Math.max(lefts.length * SL, rights.length * SR);
  const height = HEAD + inner;
  const xL = 62;
  const xR = w - 72;
  const yL = (i: number) => HEAD + (inner - lefts.length * SL) / 2 + i * SL + 30;
  const yR = (j: number) => HEAD + (inner - rights.length * SR) / 2 + j * SR + 62;

  const maxAmt = Math.max(1, ...flows.map((x) => x.amount));
  const thick = (x: Flow) => Math.max(8, Math.round((x.amount / maxAmt) * 30));
  const sum = (list: Flow[]) => list.reduce((s, x) => s + x.amount, 0);

  // 同一個人身上有好幾條金流時，上下疊在一起、不互相蓋住
  const ends = new Map<string, { yl: number; yr: number }>();
  lefts.forEach((id, i) => {
    const mine = flows.filter((x) => x.fromId === id).sort((a, b) => rank(a.toId) - rank(b.toId));
    let y = yL(i) - mine.reduce((s, x) => s + thick(x), 0) / 2;
    for (const x of mine) {
      ends.set(x.key, { yl: y + thick(x) / 2, yr: 0 });
      y += thick(x);
    }
  });
  rights.forEach((id, j) => {
    const mine = flows.filter((x) => x.toId === id).sort((a, b) => rank(a.fromId) - rank(b.fromId));
    let y = yR(j) - mine.reduce((s, x) => s + thick(x), 0) / 2;
    for (const x of mine) {
      const e = ends.get(x.key);
      if (e) e.yr = y + thick(x) / 2;
      y += thick(x);
    }
  });

  const c1 = xL + (xR - xL) * 0.55;
  const c2 = xL + (xR - xL) * 0.5;
  const shape = flows.map((x) => {
    const e = ends.get(x.key) ?? { yl: 0, yr: 0 };
    return {
      flow: x,
      d: `M${xL} ${e.yl.toFixed(1)} C${c1.toFixed(1)} ${e.yl.toFixed(1)} ${c2.toFixed(1)} ${e.yr.toFixed(1)} ${xR} ${e.yr.toFixed(1)}`,
      bx: bez(xL, c1, c2, xR, 0.4),
      by: bez(e.yl, e.yl, e.yr, e.yr, 0.4),
    };
  });

  const paidOn = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div className="flow" ref={ref} style={{ height }}>
      <svg aria-hidden="true" width={w} height={height} viewBox={`0 0 ${w} ${height}`}>
        {shape.map((s) => (
          <path key={s.flow.key} d={s.d} fill="none" stroke={s.flow.payment ? '#A9CF98' : '#FBE7A8'} strokeWidth={thick(s.flow)} />
        ))}
        {shape
          .filter((s) => !s.flow.payment)
          .map((s) => (
            <path key={s.flow.key} className="flow-dash" d={s.d} fill="none" stroke="#B97A00" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 11" />
          ))}
      </svg>

      <div className="flow-head" style={{ left: xL - 48, width: 96, top: yL(0) - 54 }}>要付的人</div>
      <div className="flow-head" style={{ left: xR - 68, width: 136, top: yR(0) - 82 }}>要收的人</div>

      {lefts.map((id, i) => {
        const m = member(id);
        const remain = sum(flows.filter((x) => x.fromId === id && !x.payment));
        return (
          <div key={id} className="flow-from" style={{ left: xL - 48, top: yL(i) - 24 }}>
            <Avatar member={m} size="xl" />
            <span className="sm ellipsis">{m.name}</span>
            {remain ? <span className="num neg">{formatMoney(remain, settle)}</span> : <span className="sm" style={{ color: '#2c5a20' }}>已付清</span>}
          </div>
        );
      })}

      {rights.map((id, j) => {
        const m = member(id);
        const mine = flows.filter((x) => x.toId === id);
        const got = sum(mine.filter((x) => x.payment));
        const all = sum(mine);
        return (
          <div key={id} className="flow-to" style={{ left: xR - 68, top: yR(j) - 55 }} aria-live="polite">
            <span className="flow-ring">
              <svg aria-hidden="true" width="110" height="110" viewBox="0 0 110 110">
                <circle cx="55" cy="55" r="46" fill="#F7FAF6" stroke="#DCE6E2" strokeWidth="7" />
                {got > 0 && (
                  <circle cx="55" cy="55" r="46" fill="none" stroke="#3F7A30" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${((got / all) * 289).toFixed(1)} 289`} transform="rotate(-90 55 55)" />
                )}
              </svg>
              <Avatar member={m} size="xxl" />
            </span>
            <span className="ellipsis" style={{ maxWidth: '100%' }}>{m.name}</span>
            <span className="sub">已收到</span>
            <span className="num" style={{ fontSize: 20, color: '#2c5a20' }}>{formatMoney(got, settle)}</span>
            <span className="num-sm sub">共 {formatMoney(all, settle)}</span>
          </div>
        );
      })}

      {shape.map((s) => {
        const x = s.flow;
        const p = x.payment;
        const from = member(x.fromId).name;
        const to = member(x.toId).name;
        const money = formatMoney(x.amount, settle);
        return (
          <button
            key={x.key}
            className={`flow-btn ${p ? 'paid' : ''}`}
            style={{ left: s.bx, top: s.by }}
            aria-pressed={Boolean(p)}
            aria-label={
              p
                ? `${from}付給${to} ${money}，${paidOn(p.createdAt)} 已付清${p.createdBy ? `，由${member(p.createdBy).name}標記` : ''}。點一下取消`
                : `${from}付給${to} ${money}，點一下標記已付`
            }
            disabled={store.busy || Boolean(p && snap.trip.locked && !isOwner)}
            onClick={() =>
              p
                ? store.act({ op: 'payment.remove', id: p.id })
                : store.act({ op: 'payment.add', fromId: x.fromId, toId: x.toId, amountMinor: x.amount })
            }
          >
            {/* 一個人只有一條金流時，金額已經寫在他的頭像下面，按鈕就不重複 */}
            {flows.filter((o) => o.fromId === x.fromId).length > 1 && <b className="num">{money}</b>}
            <span className="row" style={{ gap: 3 }}>
              {p && <Icon name="check" size={14} stroke={3} />}
              {p ? '已付清' : '標記已付'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Settle({ ctx }: { ctx: Ctx }) {
  const { snap, nav, balances, member, store, isOwner, expenses } = ctx;
  const { trip } = snap;
  const settle = trip.settleCurrency;
  const plan = planTransfers(balances.net);
  const paid = snap.payments;
  const flows: Flow[] = [
    ...plan.map((t) => ({ key: `plan-${t.fromId}-${t.toId}`, fromId: t.fromId, toId: t.toId, amount: t.amountMinor })),
    ...paid.map((p) => ({ key: p.id, fromId: p.fromId, toId: p.toId, amount: p.amountMinor, payment: p })),
  ];
  const left = plan.reduce((s, t) => s + t.amountMinor, 0);

  const paidOn = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div className="screen">
      <SubHeader
        title="結算"
        meta={`${trip.name}・總花費 ${formatMoney(balances.total, settle)}`}
        onBack={() => nav('expenses')}
        backLabel="返回記帳"
      />
      <div className="body" style={{ gap: 10 }}>
        {expenses.length === 0 ? (
          <p className="empty">還沒有花費。記幾筆之後，這裡會畫出誰該付給誰。</p>
        ) : flows.length === 0 ? (
          <p className="empty">大家剛好互不相欠，不用轉帳。</p>
        ) : (
          <>
            <FlowChart ctx={ctx} flows={flows} />

            {trip.locked ? (
              <div className="stack">
                <h2 className="h2 row" style={{ gap: 8, color: '#2c5a20', fontSize: 20 }}>
                  <Icon name="lock" />
                  全部付清，帳務已鎖定
                </h2>
                <p className="sm muted" style={{ lineHeight: 1.6 }}>
                  之後不能再新增或修改花費。只有建立旅程的人可以解鎖。
                </p>
                {isOwner && (
                  <button className="btn link" style={{ alignSelf: 'flex-start', textDecoration: 'underline' }} disabled={store.busy} onClick={() => store.act({ op: 'trip.unlock' })}>
                    解鎖帳務以便修改
                  </button>
                )}
              </div>
            ) : (
              <div className="stack">
                <h2 className="h2" style={{ fontSize: 20 }}>
                  {plan.length > 0 ? `還有 ${plan.length} 筆沒付，共 ${formatMoney(left, settle)}` : '所有轉帳都付清了'}
                </h2>
                <p className="sm muted" style={{ lineHeight: 1.6 }}>
                  點金流上的按鈕標記已付，點錯了再點一次就取消。全部付清後帳務會自動鎖定。
                </p>
              </div>
            )}

            {paid.length > 0 && (
              <section className="stack" style={{ gap: 4 }}>
                <h2 className="sm muted">已付紀錄</h2>
                {paid.map((p) => (
                  <div className="sub" key={p.id} style={{ lineHeight: 1.6 }}>
                    {paidOn(p.createdAt)}・{member(p.fromId).name}付給{member(p.toId).name} {formatMoney(p.amountMinor, settle)}
                    {p.createdBy ? `・由${member(p.createdBy).name}標記` : ''}
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── 花費統計：類別拼成版圖，每天花多少用太陽大小表示 ───────────────

export function Stats({ ctx }: { ctx: Ctx }) {
  const { snap, nav, expenses, balances, rates, member } = ctx;
  const { trip } = snap;
  const settle = trip.settleCurrency;
  const today = todayIso();
  const [picked, setPicked] = useState<string | null>(null);

  const { cats, dates } = useMemo(() => {
    const cat = new Map<string, number>();
    const date = new Map<string, number>(tripDays(trip.startDate, trip.endDate).map((d) => [d, 0]));
    for (const e of expenses) {
      const v = toSettle(e.amountMinor, e.currency, settle, rates);
      const k = catKey(e.category);
      cat.set(k, (cat.get(k) ?? 0) + v);
      date.set(e.spentOn, (date.get(e.spentOn) ?? 0) + v);
    }
    return {
      cats: [...cat.entries()].sort((a, b) => b[1] - a[1]).map(([key, value]) => ({ key, value })),
      dates: [...date.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([day, value]) => ({ day, value })),
    };
  }, [expenses, rates, settle, trip.startDate, trip.endDate]);

  const total = Math.max(1, balances.total);
  const pct = (v: number) => `${Math.round((v / total) * 100)}%`;
  const cur = picked && cats.some((c) => c.key === picked) ? picked : cats[0]?.key;
  const [first, ...rest] = cats;
  const restSum = Math.max(1, rest.reduce((s, c) => s + c.value, 0));
  const detail = expenses
    .filter((e) => catKey(e.category) === cur)
    .map((e) => ({ e, v: toSettle(e.amountMinor, e.currency, settle, rates) }))
    .sort((a, b) => b.v - a.v);
  const maxDay = Math.max(1, ...dates.map((d) => d.value));
  const unit = CURRENCIES[settle]?.name ?? settle;

  return (
    <div className="screen">
      <SubHeader
        title="花費統計"
        meta={`${trip.name}・總花費 ${formatMoney(balances.total, settle)}`}
        onBack={() => nav('expenses')}
        backLabel="返回記帳"
      />
      <div className="body" style={{ gap: 8 }}>
        {expenses.length === 0 || !first ? (
          <p className="empty">還沒有花費可以統計。</p>
        ) : (
          <>
            <h2 className="h2" style={{ fontSize: 16 }}>錢花在哪裡</h2>
            <div className="tm" role="group" aria-label="各類別花費，面積代表金額">
              <button
                className={`tm-b big cat-${first.key} ${cur === first.key ? 'on' : ''}`}
                style={{ flex: rest.length ? `0 0 ${Math.max(40, Math.min(76, (first.value / total) * 100))}%` : '1' }}
                aria-pressed={cur === first.key}
                onClick={() => setPicked(first.key)}
              >
                <span style={{ fontSize: 18 }}>{catLabel(first.key)}</span>
                <span className="num" style={{ fontSize: 26, lineHeight: 1.15 }}>{formatMoney(first.value, settle)}</span>
                <span className="num-sm sm">{pct(first.value)}</span>
                <span className="tm-art">
                  <Icon name={first.key} size={120} stroke={1.4} />
                </span>
              </button>
              {rest.length > 0 && (
                <div className="tm-col">
                  {rest.map((c) => {
                    // 依照這一塊大概有多高，決定放得下幾行字
                    const tall = (c.value / restSum) * 200;
                    const compact = tall < 46;
                    return (
                      <button
                        key={c.key}
                        className={`tm-b cat-${c.key} ${compact ? 'compact' : ''} ${cur === c.key ? 'on' : ''}`}
                        style={{ flex: `${c.value} 1 0` }}
                        aria-pressed={cur === c.key}
                        onClick={() => setPicked(c.key)}
                      >
                        <span>{catLabel(c.key)}</span>
                        <span className="num">{formatAmount(c.value, settle)}</span>
                        {tall >= 92 && <span className="num-sm" style={{ fontSize: 12 }}>{pct(c.value)}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="stack" style={{ gap: 0, minHeight: 76 }} aria-live="polite">
              <div className="tape-day" style={{ paddingTop: 6 }}>
                <h2>
                  {catLabel(cur ?? 'other')}・{detail.length} 筆
                </h2>
                <span>點版圖換類別</span>
              </div>
              {detail.slice(0, 5).map(({ e, v }) => (
                <div className="tape-line" key={e.id} style={{ minHeight: 32 }}>
                  <span className="tape-name ellipsis" style={{ fontSize: 15 }}>{e.description}</span>
                  <span className="sub" style={{ flex: 'none' }}>{member(e.payerId).name}付</span>
                  <span className="leader" />
                  <span className="num" style={{ fontSize: 15 }}>{formatMoney(v, settle)}</span>
                </div>
              ))}
              {detail.length > 5 && <div className="sub">還有 {detail.length - 5} 筆較小的花費</div>}
            </div>

            <h2 className="h2" style={{ fontSize: 16, paddingTop: 6 }}>每天花多少</h2>
            <div className="suns">
              {dates.map((d) => {
                const size = d.value ? Math.max(14, Math.round(Math.sqrt(d.value / maxDay) * 84)) : 16;
                return (
                  <div className="sun-col" key={d.day}>
                    <span className={`sun ${d.value ? '' : 'none'}`} style={{ width: size, height: size }} />
                    <span className="sun-lbl">
                      <span className={d.day === today ? '' : 'muted'}>{d.day === today ? '今天' : md(d.day)}</span>
                      <b className="num">{d.value ? formatAmount(d.value, settle) : ''}</b>
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="row spread" style={{ alignItems: 'baseline', paddingTop: 6 }}>
              <h2 className="h2" style={{ fontSize: 16 }}>每人旅費</h2>
              <span className="sub">分攤額加個人花費</span>
            </div>
            <div className="grid-auto">
              {snap.members.map((m) => (
                <div className="stack center" key={m.id} style={{ gap: 3, alignItems: 'center', minWidth: 0 }}>
                  <Avatar member={m} size="lg" />
                  <span className="ellipsis" style={{ fontSize: 13, maxWidth: '100%' }}>{m.name}</span>
                  <span className="num" style={{ fontSize: 15 }}>{formatAmount(balances.cost[m.id] ?? 0, settle)}</span>
                </div>
              ))}
            </div>

            <p className="sub center" style={{ paddingTop: 8 }}>
              金額皆已換算為{unit}
              {decimalsOf(settle) === 0 ? '，四捨五入到整數' : ''}。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
