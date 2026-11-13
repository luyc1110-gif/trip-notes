'use client';

import { useState } from 'react';
import { CURRENCIES, symbolOf } from '@/lib/money';
import { COVERS } from '@/lib/types';
import type { Ctx } from '../TripApp';
import { Scene } from '../Scenes';
import { Avatar, Icon } from '../ui';

export default function Settings({ ctx }: { ctx: Ctx }) {
  const { snap, store, nav } = ctx;
  const { trip } = snap;
  const settle = trip.settleCurrency;

  const [name, setName] = useState(trip.name);
  const [startDate, setStartDate] = useState(trip.startDate);
  const [endDate, setEndDate] = useState(trip.endDate);
  const [cover, setCover] = useState(trip.cover);
  const [newMember, setNewMember] = useState('');
  const [openMember, setOpenMember] = useState<string | null>(null);
  const [rateDraft, setRateDraft] = useState<Record<string, string>>({});
  const unused = Object.keys(CURRENCIES).filter((c) => c !== settle && !snap.currencies.some((x) => x.code === c));
  const [newCode, setNewCode] = useState(unused[0] ?? '');
  const [newRate, setNewRate] = useState('');
  const [copied, setCopied] = useState(false);

  const dirty = name !== trip.name || startDate !== trip.startDate || endDate !== trip.endDate || cover !== trip.cover;
  const link = typeof window !== 'undefined' && trip.inviteToken ? `${window.location.origin}/join/${trip.inviteToken}` : '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      store.notify('無法自動複製，請長按連結文字手動複製');
    }
  }

  async function saveRate(code: string) {
    const rate = Number(rateDraft[code]);
    if (!(rate > 0)) return store.notify('匯率必須是大於 0 的數字');
    if (await store.act({ op: 'currency.set', code, rate })) {
      setRateDraft(({ [code]: _omit, ...rest }) => rest);
    }
  }

  async function addCurrency() {
    const rate = Number(newRate);
    if (!newCode) return;
    if (!(rate > 0)) return store.notify('請輸入匯率，例如日圓填 0.21');
    if (await store.act({ op: 'currency.set', code: newCode, rate })) {
      setNewRate('');
      setNewCode(unused.find((c) => c !== newCode) ?? '');
    }
  }

  return (
    <div className="screen">
      <header className="band" style={{ height: 96 }}>
        <svg aria-hidden="true" viewBox="0 0 390 96" preserveAspectRatio="xMaxYMax slice">
          <rect width="390" height="96" fill="#CDEAF7" />
          <circle cx="336" cy="40" r="50" fill="#FBE7A8" opacity="0.4" />
          <circle cx="336" cy="40" r="34" fill="#FBE7A8" opacity="0.7" />
          <circle cx="336" cy="40" r="21" fill="#F2B33D" />
          <path d="M0 96 L0 86 Q100 72 200 88 T390 80 L390 96 Z" fill="#4F8A3C" />
        </svg>
        <div className="band-text with-back" style={{ alignItems: 'center' }}>
          <button className="icon-btn" aria-label="返回總覽" onClick={() => nav('home')}>
            <Icon name="chevL" stroke={2.2} />
          </button>
          <h1 style={{ fontSize: 28 }}>旅程設定</h1>
        </div>
      </header>

      <div className="body" style={{ gap: 20 }}>
        <section className="stack" style={{ gap: 10 }}>
          <div className="field">
            <label className="label" htmlFor="trip-name">旅程名稱</label>
            <input id="trip-name" className="input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid2">
            <div className="field">
              <label className="label" htmlFor="trip-start">開始日期</label>
              <input id="trip-start" className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="field">
              <label className="label" htmlFor="trip-end">結束日期</label>
              <input id="trip-end" className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="field" role="group" aria-label="封面場景">
            <div className="label">封面場景</div>
            <div className="grid4">
              {COVERS.map((c) => (
                <button key={c.key} className={`cover-pick ${cover === c.key ? 'on' : ''}`} aria-pressed={cover === c.key} onClick={() => setCover(c.key)}>
                  <Scene kind={c.key} crop="cover" />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>
          {dirty && (
            <button className="btn blue" disabled={store.busy} onClick={() => store.act({ op: 'trip.update', name, startDate, endDate, cover })}>
              儲存變更
            </button>
          )}
        </section>

        <section className="stack">
          <h2 className="h2" style={{ fontSize: 16 }}>成員・{snap.members.length} 人</h2>
          <div className="grid2">
            {snap.members.map((m) => (
              <button key={m.id} className="item" style={{ minHeight: 52, padding: '6px 12px', gap: 10 }} aria-expanded={openMember === m.id} onClick={() => setOpenMember(openMember === m.id ? null : m.id)}>
                <Avatar member={m} size="sm" />
                <span className="stack grow" style={{ gap: 1 }}>
                  <span className="ellipsis" style={{ fontSize: 15 }}>{m.name}</span>
                  <span className="sub" style={m.claimed ? { color: '#2c5a20' } : undefined}>
                    {m.isOwner ? '已認領・你' : m.claimed ? '已認領' : '尚未認領'}
                  </span>
                </span>
              </button>
            ))}
          </div>
          {snap.members
            .filter((m) => m.id === openMember)
            .map((m) => (
              <div className="notice row" key={m.id} style={{ flexWrap: 'wrap', gap: 8 }}>
                <span className="grow">{m.name}</span>
                <button
                  className="btn"
                  style={{ minHeight: 44 }}
                  disabled={store.busy}
                  onClick={() => {
                    const next = window.prompt('新的名字', m.name);
                    if (next && next.trim() && next.trim() !== m.name) void store.act({ op: 'member.rename', id: m.id, name: next.trim() });
                  }}
                >
                  改名
                </button>
                {m.claimed && !m.isOwner && (
                  <button className="btn" style={{ minHeight: 44 }} disabled={store.busy} onClick={() => window.confirm(`取消後，${m.name}原本的手機會無法再進入，需要重新點邀請連結認領。確定嗎？`) && store.act({ op: 'member.unclaim', id: m.id })}>
                    取消認領
                  </button>
                )}
                {!m.isOwner && (
                  <button className="btn" style={{ minHeight: 44, color: 'var(--orange)' }} disabled={store.busy} onClick={() => window.confirm(`確定要移除${m.name}嗎？`) && store.act({ op: 'member.remove', id: m.id }).then((ok) => ok && setOpenMember(null))}>
                    移除
                  </button>
                )}
              </div>
            ))}
          <form
            className="row"
            style={{ gap: 8 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (newMember.trim()) void store.act({ op: 'member.add', name: newMember.trim() }).then((ok) => ok && setNewMember(''));
            }}
          >
            <input className="input" aria-label="新成員的名字" maxLength={20} placeholder="新成員的名字" value={newMember} onChange={(e) => setNewMember(e.target.value)} />
            <button className="btn blue" type="submit" disabled={store.busy || !newMember.trim()}>新增</button>
          </form>
        </section>

        <section className="stack">
          <h2 className="h2" style={{ fontSize: 16 }}>匯率・以{CURRENCIES[settle]?.name ?? settle}結算</h2>
          {snap.currencies.length === 0 && <p className="sub">還沒有外幣。只用{CURRENCIES[settle]?.name ?? settle}記帳的話不需要設定。</p>}
          {snap.currencies.map((c) => {
            const value = rateDraft[c.code] ?? String(c.rate);
            const changed = rateDraft[c.code] !== undefined && rateDraft[c.code] !== String(c.rate);
            return (
              <div className="item" key={c.code} style={{ minHeight: 56, padding: '6px 8px 6px 16px', gap: 8 }}>
                <label className="grow num-sm" htmlFor={`rate-${c.code}`}>
                  {CURRENCIES[c.code]?.name ?? c.code} {symbolOf(c.code)}1 =
                </label>
                <span className="num-sm muted">{symbolOf(settle)}</span>
                <input id={`rate-${c.code}`} className="input num" style={{ width: 96, height: 44, textAlign: 'right', padding: '0 10px' }} inputMode="decimal" value={value} onChange={(e) => setRateDraft({ ...rateDraft, [c.code]: e.target.value })} />
                {changed ? (
                  <button className="btn blue" style={{ minHeight: 44, padding: '0 12px' }} disabled={store.busy} onClick={() => saveRate(c.code)}>儲存</button>
                ) : (
                  <button className="icon-btn muted" aria-label={`移除${CURRENCIES[c.code]?.name ?? c.code}`} disabled={store.busy} onClick={() => store.act({ op: 'currency.remove', code: c.code })}>
                    <Icon name="trash" size={20} />
                  </button>
                )}
              </div>
            );
          })}
          {unused.length > 0 && (
            <div className="row" style={{ gap: 8 }}>
              <select className="input" aria-label="要新增的幣別" value={newCode} onChange={(e) => setNewCode(e.target.value)} style={{ flex: 1.4 }}>
                {unused.map((c) => (
                  <option key={c} value={c}>
                    {CURRENCIES[c].name} {c}
                  </option>
                ))}
              </select>
              <input className="input num" aria-label={`1 單位外幣等於多少${CURRENCIES[settle]?.name ?? settle}`} inputMode="decimal" placeholder="匯率" value={newRate} onChange={(e) => setNewRate(e.target.value)} style={{ flex: 1 }} />
              <button className="btn blue" disabled={store.busy} onClick={addCurrency}>新增</button>
            </div>
          )}
          <p className="sub">改匯率會重新換算這趟旅程所有使用該幣別的花費。</p>
        </section>

        <section className="stack">
          <h2 className="h2" style={{ fontSize: 16 }}>邀請連結</h2>
          <div className="link-box num-sm">{link}</div>
          <div className="grid2">
            <button className="btn blue" onClick={copy}>{copied ? '已複製' : '複製連結'}</button>
            <button className="btn outline warn" disabled={store.busy} onClick={() => window.confirm('重置後舊連結立即失效，所有同行者都要用新連結重新認領。確定要重置嗎？') && store.act({ op: 'invite.reset' })}>
              重置連結
            </button>
          </div>
          <p className="sub" style={{ lineHeight: 1.5 }}>
            拿到連結的人都能編輯行程與記帳。重置後舊連結立即失效，大家要用新連結重新認領。
          </p>
        </section>

        <button
          className="btn danger"
          disabled={store.busy}
          onClick={async () => {
            if (!window.confirm(`確定要刪除「${trip.name}」嗎？行程與所有帳務都會一起移除。`)) return;
            if (await store.act({ op: 'trip.delete' })) window.location.href = '/';
          }}
        >
          刪除這趟旅程
        </button>
      </div>
    </div>
  );
}
