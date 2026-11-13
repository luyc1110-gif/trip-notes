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
import { CATEGORIES, type Expense } from '@/lib/types';
import type { Ctx } from '../TripApp';
import { SkyBand } from '../Scenes';
import { Avatar, Icon, longDate, md, todayIso } from '../ui';

const catLabel = (key: string) => CATEGORIES.find((c) => c.key === key)?.label ?? '其他';

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

// ── 記帳（花費列表） ─────────────────────────────────────

export function Expenses({ ctx }: { ctx: Ctx }) {
  const { snap, expenses, nav, balances, member, store, rates } = ctx;
  const { trip } = snap;
  const settle = trip.settleCurrency;
  const today = todayIso();
  const transfers = planTransfers(balances.net).length;
  const pendingCount = expenses.filter((e) => e.pending).length;

  const groups = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of expenses) map.set(e.spentOn, [...(map.get(e.spentOn) ?? []), e]);
    return [...map.entries()];
  }, [expenses]);

  const settleLabel =
    expenses.length === 0 ? '結算' : transfers === 0 ? '已全部結清' : `結算・${transfers} 筆轉帳`;

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

      <div className="body with-tabs">
        <div className={snap.members.length <= 4 ? 'grid4' : 'grid-auto'}>
          {snap.members.map((m) => {
            const v = balances.net[m.id] ?? 0;
            return (
              <div className="tile" key={m.id}>
                <Avatar member={m} />
                <div className="name">{m.name}</div>
                <div className={`num ${v > 0 ? 'pos' : v < 0 ? 'neg' : 'muted'}`} style={{ fontSize: 15 }}>
                  {formatSigned(v, settle)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid2">
          <button className="btn blue" style={{ minHeight: 52, borderRadius: 16 }} onClick={() => nav('settle')}>
            {settleLabel}
          </button>
          <button className="btn soft" style={{ minHeight: 52, borderRadius: 16 }} onClick={() => nav('stats')}>
            花費統計
          </button>
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

        {expenses.length === 0 && <p className="empty">還沒有任何花費。按下方的 ＋ 記第一筆。</p>}

        {groups.map(([date, list]) => (
          <section className="stack" key={date}>
            <h2 className="sm muted">
              {longDate(date)}
              {date === today ? '・今天' : ''}
            </h2>
            {list.map((e) => {
              const settleAmt = toSettle(e.amountMinor, e.currency, settle, rates);
              const who = e.isPersonal
                ? `${member(e.payerId).name}付・個人花費`
                : `${member(e.payerId).name}付・${e.participantIds.length} 人均分`;
              return (
                <button
                  key={e.id}
                  className={`item ${e.pending ? 'pending' : ''}`}
                  onClick={() => (e.pending ? store.notify('這筆還在等待上傳，同步後才能修改') : nav('add', e.id))}
                >
                  <span className={`cat cat-${e.category}`}>
                    <Icon name={e.category} size={22} />
                  </span>
                  <span className="grow stack" style={{ gap: 2 }}>
                    <span className="ellipsis">{e.description}</span>
                    <span className="sub ellipsis">
                      {who}
                      {e.pending ? '・待同步' : ''}
                    </span>
                  </span>
                  <span className="stack" style={{ gap: 2, alignItems: 'flex-end' }}>
                    <span className="num">{formatMoney(e.amountMinor, e.currency)}</span>
                    {e.currency !== settle && <span className="sub num-sm">{formatMoney(settleAmt, settle)}</span>}
                  </span>
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}

// ── 記一筆（新增／修改花費） ───────────────────────────────

export function AddExpense({ ctx }: { ctx: Ctx }) {
  const { snap, route, nav, store, me, rates } = ctx;
  const { trip } = snap;
  const settle = trip.settleCurrency;
  const existing = route.id ? snap.expenses.find((e) => e.id === route.id) : undefined;
  const codes = [...snap.currencies.map((c) => c.code), settle];
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
  const [spentOn, setSpentOn] = useState(existing?.spentOn ?? todayIso());
  const [category, setCategory] = useState(existing?.category ?? 'food');
  const [payerId, setPayerId] = useState(existing?.payerId ?? me.id);
  const [participants, setParticipants] = useState<string[]>(
    existing && !existing.isPersonal ? existing.participantIds : snap.members.map((m) => m.id),
  );
  const [personal, setPersonal] = useState(existing?.isPersonal ?? false);
  const [error, setError] = useState('');

  const minor = toMinor(amount, currency);
  const settleAmt = minor ? toSettle(minor, currency, settle, rates) : 0;
  const perHead = minor && participants.length ? Math.floor(minor / participants.length) : 0;
  const many = snap.members.length > 4;

  const toggle = (id: string) =>
    setParticipants((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  async function save() {
    if (!minor) return setError('請輸入大於 0 的金額');
    if (!description.trim()) return setError('請填寫說明，例如「午餐」');
    if (!spentOn) return setError('請選擇日期');
    if (!personal && participants.length === 0) return setError('請至少選一位要分攤的人');
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
        participantIds: personal ? [payerId] : participants,
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
      <header style={{ background: 'var(--sky)', paddingTop: 8 }}>
        <div className="row" style={{ gap: 4, padding: '0 8px' }}>
          <button className="icon-btn" aria-label="關閉" onClick={() => nav('expenses')}>
            <Icon name="close" stroke={2.2} />
          </button>
          <h1 style={{ fontSize: 20 }}>{existing ? '修改花費' : '記一筆'}</h1>
        </div>
        <div className="stack" style={{ gap: 6, padding: '6px 24px 4px' }}>
          <div className="amount-row">
            <select className="input" aria-label="幣別" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {codes.map((c) => (
                <option key={c} value={c}>
                  {c} {symbolOf(c)}
                </option>
              ))}
            </select>
            <input
              className="amount-input"
              aria-label="金額"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
            />
          </div>
          <div className="num-sm sm" style={{ color: 'var(--ink2)', minHeight: 20 }}>
            {currency !== settle && minor
              ? `約 ${formatMoney(settleAmt, settle)}・匯率 ${rates[currency]}`
              : currency !== settle
                ? `匯率 ${symbolOf(currency)}1 = ${symbolOf(settle)}${rates[currency]}`
                : ''}
          </div>
        </div>
        <svg aria-hidden="true" viewBox="0 0 390 24" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 24 }}>
          <path d="M0 24 L0 12 Q100 -4 200 14 T390 6 L390 24 Z" fill="#4F8A3C" />
        </svg>
      </header>
      {!store.online && <OfflineBanner text="目前離線，會先存在手機，連線後自動上傳" />}
      {trip.locked && <OfflineBanner text="帳務已結清並鎖定，需要旅程建立者解鎖後才能儲存" />}

      <div className="body">
        <div className="row" style={{ gap: 10, alignItems: 'flex-end' }}>
          <div className="field grow">
            <label className="label" htmlFor="exp-note">說明</label>
            <input id="exp-note" className="input" maxLength={80} placeholder="例如：午餐" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="field" style={{ width: 152 }}>
            <label className="label" htmlFor="exp-date">日期</label>
            <input id="exp-date" className="input" type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
          </div>
        </div>

        <div className="field" role="group" aria-label="類別">
          <div className="label">類別</div>
          <div className="grid3">
            {CATEGORIES.map((c) => (
              <button key={c.key} className={`chip ${category === c.key ? 'on' : ''}`} aria-pressed={category === c.key} onClick={() => setCategory(c.key)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field" role="group" aria-label="誰付的">
          <div className="label">誰付的</div>
          <div className={many ? 'grid-auto' : 'grid4'}>
            {snap.members.map((m) => (
              <button key={m.id} className={`chip ${payerId === m.id ? 'on' : ''}`} aria-pressed={payerId === m.id} onClick={() => setPayerId(m.id)}>
                <span>{m.name}</span>
              </button>
            ))}
          </div>
        </div>

        {!personal && (
          <div className="field" role="group" aria-label="誰要分">
            <div className="row spread">
              <div className="label">誰要分</div>
              <div className="num-sm" style={{ fontSize: 13, color: 'var(--ink2)' }}>
                {participants.length} 人均分
                {perHead ? `・每人 ${formatMoney(perHead, currency)}` : ''}
              </div>
            </div>
            <div className={many ? 'grid-auto' : 'grid4'}>
              {snap.members.map((m) => {
                const on = participants.includes(m.id);
                return (
                  <button key={m.id} className={`chip multi ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggle(m.id)}>
                    {on && (
                      <span style={{ color: 'var(--blue)', display: 'flex', flex: 'none' }}>
                        <Icon name="check" size={16} stroke={3} />
                      </span>
                    )}
                    <span>{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="row spread" style={{ minHeight: 48 }}>
          <div className="stack" style={{ gap: 2 }}>
            <div style={{ fontSize: 15 }}>個人花費</div>
            <div className="sub">只算付款人自己的，不進分帳</div>
          </div>
          <button className="switch" role="switch" aria-checked={personal} aria-label="個人花費" onClick={() => setPersonal((v) => !v)}>
            <i />
          </button>
        </div>

        {error && <p className="neg sm" role="alert">{error}</p>}
        <button className="btn primary" onClick={save} disabled={store.busy || trip.locked}>
          {store.busy ? '儲存中…' : '儲存'}
        </button>
        {existing && (
          <button className="btn danger" onClick={remove} disabled={store.busy || trip.locked}>
            刪除這筆花費
          </button>
        )}
      </div>
    </div>
  );
}

// ── 結算 ────────────────────────────────────────────────

export function Settle({ ctx }: { ctx: Ctx }) {
  const { snap, nav, balances, gross, member, store, isOwner, expenses } = ctx;
  const { trip } = snap;
  const settle = trip.settleCurrency;
  const plan = planTransfers(balances.net);
  const paid = snap.payments;
  const total = plan.length + paid.length;

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
      <div className="body">
        {expenses.length === 0 ? (
          <p className="empty">還沒有花費。記幾筆之後，這裡會算出誰該付給誰。</p>
        ) : (
          <>
            <section className="card">
              <div className="row spread" style={{ alignItems: 'baseline' }}>
                <div>{total === 0 ? '大家剛好互不相欠' : `已付清 ${paid.length}／${total} 筆`}</div>
                <div className="sub">{trip.locked ? '帳務已鎖定' : '全部付清後帳務會鎖定'}</div>
              </div>
              <div className="progress" role="img" aria-label={`付清進度：${total} 筆中的 ${paid.length} 筆`}>
                <div style={{ width: `${total ? (paid.length / total) * 100 : 100}%` }} />
              </div>
            </section>

            {trip.locked && (
              <div className="notice stack">
                <span>所有轉帳都已付清，帳務已鎖定。</span>
                {isOwner && (
                  <button className="btn outline" disabled={store.busy} onClick={() => store.act({ op: 'trip.unlock' })}>
                    解鎖帳務以便修改
                  </button>
                )}
              </div>
            )}

            {(plan.length > 0 || paid.length > 0) && (
              <section className="stack">
                <h2 className="sm muted">轉帳方案{plan.length > 0 ? `・還有 ${plan.length} 筆待付` : ''}</h2>
                {plan.map((t) => (
                  <div className="card" key={`${t.fromId}-${t.toId}`} style={{ padding: 14 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <Avatar member={member(t.fromId)} />
                      <span className="sm ellipsis">{member(t.fromId).name}</span>
                      <span className="muted" style={{ display: 'flex', flex: 'none' }}>
                        <Icon name="arrow" size={22} />
                      </span>
                      <Avatar member={member(t.toId)} />
                      <span className="sm ellipsis grow">{member(t.toId).name}</span>
                      <span className="num" style={{ fontSize: 20 }}>{formatMoney(t.amountMinor, settle)}</span>
                    </div>
                    <button
                      className="btn outline"
                      style={{ minHeight: 44 }}
                      disabled={store.busy}
                      onClick={() => store.act({ op: 'payment.add', fromId: t.fromId, toId: t.toId, amountMinor: t.amountMinor })}
                    >
                      標記已付
                    </button>
                  </div>
                ))}
                {paid.map((p) => (
                  <div className="card done" key={p.id} style={{ padding: 14, gap: 6 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <Avatar member={member(p.fromId)} />
                      <span className="sm ellipsis">{member(p.fromId).name}</span>
                      <span className="muted" style={{ display: 'flex', flex: 'none' }}>
                        <Icon name="arrow" size={22} />
                      </span>
                      <Avatar member={member(p.toId)} />
                      <span className="sm ellipsis grow">{member(p.toId).name}</span>
                      <span className="num" style={{ fontSize: 20 }}>{formatMoney(p.amountMinor, settle)}</span>
                    </div>
                    <div className="row spread">
                      <span className="row sm" style={{ gap: 6, color: '#2c5a20' }}>
                        <Icon name="check" size={18} stroke={2.6} />
                        已付清・{paidOn(p.createdAt)}
                        {p.createdBy ? ` 由${member(p.createdBy).name}標記` : ''}
                      </span>
                      {(!trip.locked || isOwner) && (
                        <button className="btn danger" style={{ color: 'var(--ink2)' }} disabled={store.busy} onClick={() => store.act({ op: 'payment.remove', id: p.id })}>
                          取消
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </section>
            )}

            <section className="stack">
              <h2 className="sm muted">每人淨額（未扣除已付的轉帳）</h2>
              <div className={snap.members.length <= 4 ? 'grid4' : 'grid-auto'}>
                {snap.members.map((m) => {
                  const v = gross.net[m.id] ?? 0;
                  return (
                    <div className="tile" key={m.id} style={{ padding: '10px 4px', gap: 2 }}>
                      <div className="name">{m.name}</div>
                      <div className="sub">{v > 0 ? '應收' : v < 0 ? '應付' : '打平'}</div>
                      <div className={`num ${v > 0 ? 'pos' : v < 0 ? 'neg' : 'muted'}`} style={{ fontSize: 15 }}>
                        {formatSigned(v, settle)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

// ── 花費統計 ─────────────────────────────────────────────

function Bars({ rows, tone, settle }: { rows: { label: string; value: number }[]; tone: string; settle: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="bars">
      {rows.map((r) => (
        <div key={r.label} style={{ display: 'contents' }}>
          <div>{r.label}</div>
          <div style={{ display: 'flex' }}>
            <div className={`bar ${tone}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <div className="num-sm" style={{ textAlign: 'right' }}>{formatMoney(r.value, settle)}</div>
        </div>
      ))}
    </div>
  );
}

export function Stats({ ctx }: { ctx: Ctx }) {
  const { snap, nav, expenses, balances, rates } = ctx;
  const settle = snap.trip.settleCurrency;

  const { byCategory, byDate } = useMemo(() => {
    const cat = new Map<string, number>();
    const date = new Map<string, number>();
    for (const e of expenses) {
      const v = toSettle(e.amountMinor, e.currency, settle, rates);
      cat.set(e.category, (cat.get(e.category) ?? 0) + v);
      date.set(e.spentOn, (date.get(e.spentOn) ?? 0) + v);
    }
    return {
      byCategory: [...cat.entries()].sort((a, b) => b[1] - a[1]).map(([k, value]) => ({ label: catLabel(k), value })),
      byDate: [...date.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, value]) => ({ label: md(k), value })),
    };
  }, [expenses, rates, settle]);

  const perMember = snap.members.map((m) => ({ label: m.name, value: balances.cost[m.id] ?? 0 }));
  const unit = CURRENCIES[settle]?.name ?? settle;

  return (
    <div className="screen">
      <SubHeader
        title="花費統計"
        meta={`${snap.trip.name}・總花費 ${formatMoney(balances.total, settle)}`}
        onBack={() => nav('expenses')}
        backLabel="返回記帳"
      />
      <div className="body">
        {expenses.length === 0 ? (
          <p className="empty">還沒有花費可以統計。</p>
        ) : (
          <>
            <section className="card">
              <h2>依類別</h2>
              <Bars rows={byCategory} tone="" settle={settle} />
            </section>
            <section className="card">
              <div className="row spread" style={{ alignItems: 'baseline' }}>
                <h2>每人旅費</h2>
                <span className="sub">分攤額加個人花費</span>
              </div>
              <Bars rows={perMember} tone="green" settle={settle} />
            </section>
            <section className="card">
              <h2>依日期</h2>
              <Bars rows={byDate} tone="gold" settle={settle} />
            </section>
            <p className="sub center">
              金額皆已換算為{unit}
              {decimalsOf(settle) === 0 ? '，四捨五入到整數' : ''}。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
