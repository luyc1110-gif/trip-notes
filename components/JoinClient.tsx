'use client';

import { useState } from 'react';
import { Scene } from './Scenes';
import { Avatar, Icon, md } from './ui';

type JoinMember = { id: string; name: string; color: number; claimed: boolean };

export default function JoinClient({
  token,
  trip,
  ownerName,
  members,
}: {
  token: string;
  trip: { name: string; startDate: string; endDate: string; cover: string };
  ownerName: string;
  members: JoinMember[];
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pickedName = members.find((m) => m.id === picked)?.name;

  async function join() {
    if (!picked) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, memberId: picked }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? '加入失敗，請再試一次');
        setBusy(false);
        return;
      }
      window.location.href = `/t/${data.tripId}`;
    } catch {
      setError('連不上網路，請稍後再試');
      setBusy(false);
    }
  }

  return (
    <main className="app">
      <header className="hero">
        <Scene kind={trip.cover} />
        <div className="hero-text">
          <div className="meta">{ownerName}邀請你一起出發</div>
          <h1>{trip.name}</h1>
          <div className="meta num-sm">
            {md(trip.startDate)} – {md(trip.endDate)}・{members.length} 人同行
          </div>
        </div>
      </header>

      <div className="body" style={{ gap: 16, paddingTop: 20 }}>
        <div className="stack" style={{ gap: 6 }}>
          <h2 style={{ fontSize: 22 }}>你是哪一位？</h2>
          <p className="sm muted" style={{ lineHeight: 1.5 }}>選一次就好，這支手機會記住你，不用註冊。</p>
        </div>

        <div className="grid2" role="group" aria-label="選擇你的名字" style={{ gap: 10 }}>
          {members.map((m) =>
            m.claimed ? (
              <button key={m.id} className="item" disabled style={{ minHeight: 72, borderRadius: 20, background: '#e6ece8', opacity: 1 }}>
                <span className="avatar lg" style={{ background: 'var(--field)' }} aria-hidden="true">
                  {m.name.slice(-1)}
                </span>
                <span className="stack" style={{ gap: 2 }}>
                  <span style={{ fontSize: 17, color: '#3f5247' }}>{m.name}</span>
                  <span className="sub">已認領</span>
                </span>
              </button>
            ) : (
              <button
                key={m.id}
                className="item"
                aria-pressed={picked === m.id}
                onClick={() => setPicked(m.id)}
                style={{
                  minHeight: 72,
                  borderRadius: 20,
                  border: picked === m.id ? '2px solid var(--blue)' : '2px solid transparent',
                  background: picked === m.id ? 'var(--pale-blue)' : '#fff',
                }}
              >
                <Avatar member={m} size="lg" />
                <span className="grow ellipsis" style={{ fontSize: 17 }}>{m.name}</span>
                {picked === m.id && (
                  <span style={{ color: 'var(--blue)', display: 'flex' }}>
                    <Icon name="check" size={22} stroke={3} />
                  </span>
                )}
              </button>
            ),
          )}
        </div>

        {error && <p className="neg sm" role="alert">{error}</p>}
        <button className="btn primary" disabled={!picked || busy} onClick={join}>
          {busy ? '加入中…' : pickedName ? `我是${pickedName}，加入旅程` : '先選自己的名字'}
        </button>
        <p className="sub center" style={{ fontSize: 13, lineHeight: 1.5 }}>
          名單由{ownerName}建立。找不到自己的名字，請聯絡{ownerName}。
        </p>
      </div>
    </main>
  );
}
