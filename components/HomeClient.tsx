'use client';

import { useEffect, useState } from 'react';
import { CURRENCIES } from '@/lib/money';
import type { TripSummary } from '@/lib/trip';
import { COVERS } from '@/lib/types';
import { Scene } from './Scenes';
import { Icon, md, todayIso, tripDays } from './ui';

/** 同行者把 App 加到主畫面後，從首頁開啟時直接帶回上次的旅程 */
export function GuestRedirect() {
  useEffect(() => {
    try {
      const id = JSON.parse(localStorage.getItem('th:lastTrip') ?? 'null');
      if (typeof id === 'string' && id) window.location.replace(`/t/${id}`);
    } catch {
      /* 略過 */
    }
  }, []);
  return null;
}

function statusOf(t: TripSummary, today: string): { text: string; tone: string } {
  if (today >= t.startDate && today <= t.endDate) {
    return { text: `進行中・第 ${tripDays(t.startDate, t.endDate).indexOf(today) + 1} 天`, tone: 'blue' };
  }
  if (today < t.startDate) return { text: '尚未出發', tone: 'gold' };
  return t.locked ? { text: '已結清', tone: 'green' } : { text: '已結束', tone: 'gold' };
}

export default function HomeClient({ trips, email }: { trips: TripSummary[]; email: string }) {
  const [creating, setCreating] = useState(false);
  const today = todayIso();

  return (
    <main className="app">
      <div className="body" style={{ gap: 16, paddingTop: 20 }}>
        <div className="row spread">
          <h1 className="h1">我的旅程</h1>
          <form method="post" action="/api/auth/logout">
            <button className="btn link" type="submit" title={email}>登出</button>
          </form>
        </div>

        {trips.length === 0 && <p className="empty">還沒有旅程。建立第一趟，再把邀請連結傳給同行的人。</p>}

        {trips.map((t) => {
          const s = statusOf(t, today);
          return (
            <a className="trip-card" href={`/t/${t.id}`} key={t.id}>
              <div className="cover">
                <Scene kind={t.cover} crop="cover" />
              </div>
              <div className="info">
                <div className="grow stack" style={{ gap: 3 }}>
                  <div className="ellipsis" style={{ fontSize: 19 }}>{t.name}</div>
                  <div className="num-sm sub" style={{ fontSize: 13 }}>
                    {md(t.startDate)} – {md(t.endDate)}・{t.memberCount} 人
                  </div>
                </div>
                <span className={`pill ${s.tone}`}>{s.text}</span>
              </div>
            </a>
          );
        })}

        <button className="btn primary" style={{ marginTop: 'auto' }} onClick={() => setCreating(true)}>
          <Icon name="plus" size={22} stroke={2.5} />
          建立新旅程
        </button>
      </div>
      {creating && <CreateSheet onClose={() => setCreating(false)} />}
    </main>
  );
}

function CreateSheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [settleCurrency, setSettleCurrency] = useState('TWD');
  const [cover, setCover] = useState('town');
  const [members, setMembers] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const memberNames = members.split(/\n|,|，|、/).map((s) => s.trim()).filter(Boolean);
    if (!name.trim()) return setError('請填寫旅程名稱');
    if (!startDate || !endDate) return setError('請選擇開始與結束日期');
    if (memberNames.length === 0) return setError('請至少填一位成員，第一位是你自己');
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), startDate, endDate, settleCurrency, cover, memberNames }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? '建立失敗，請再試一次');
      window.location.href = `/t/${data.id}`;
    } catch {
      setError('連不上網路，請稍後再試');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="建立新旅程">
        <div className="row spread">
          <h2 className="h2">建立新旅程</h2>
          <button className="icon-btn" aria-label="關閉" onClick={onClose}>
            <Icon name="close" stroke={2.2} />
          </button>
        </div>
        <div className="field">
          <label className="label" htmlFor="new-name">旅程名稱</label>
          <input id="new-name" className="input" maxLength={40} placeholder="例如：京都五日" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid2">
          <div className="field">
            <label className="label" htmlFor="new-start">開始日期</label>
            <input id="new-start" className="input" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value); }} />
          </div>
          <div className="field">
            <label className="label" htmlFor="new-end">結束日期</label>
            <input id="new-end" className="input" type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="new-members">成員名單（每行一位，第一位是你自己）</label>
          <textarea id="new-members" className="input" rows={4} placeholder={'小政\n阿美\n小明\n媽媽'} value={members} onChange={(e) => setMembers(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="new-settle">結算幣別（之後不能更改）</label>
          <select id="new-settle" className="input" value={settleCurrency} onChange={(e) => setSettleCurrency(e.target.value)}>
            {Object.entries(CURRENCIES).map(([code, c]) => (
              <option key={code} value={code}>
                {c.name} {code}
              </option>
            ))}
          </select>
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
        {error && <p className="neg sm" role="alert">{error}</p>}
        <button className="btn primary" onClick={submit} disabled={busy}>
          {busy ? '建立中…' : '建立旅程'}
        </button>
      </div>
    </div>
  );
}
