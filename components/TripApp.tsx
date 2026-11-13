'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { computeBalances, type Balances } from '@/lib/money';
import type { Expense, Member, Snapshot } from '@/lib/types';
import { Icon } from './ui';
import { useTrip, type TripStore } from './useTrip';
import Overview from './views/Overview';
import Itinerary from './views/Itinerary';
import { AddExpense, Expenses, Settle, Stats } from './views/Money';
import Todos from './views/Todos';
import Settings from './views/Settings';

export type View = 'home' | 'itinerary' | 'expenses' | 'add' | 'settle' | 'stats' | 'todos' | 'settings';
type Route = { v: View; id?: string };

export type Ctx = {
  snap: Snapshot;
  store: TripStore;
  nav: (v: View, id?: string) => void;
  route: Route;
  me: Member;
  isOwner: boolean;
  member: (id: string) => Member;
  /** 已上傳的花費加上離線排隊中的花費 */
  expenses: Expense[];
  rates: Record<string, number>;
  /** 扣掉已標記付清的轉帳後的餘額 */
  balances: Balances;
  /** 不看轉帳的原始淨額 */
  gross: Balances;
  mapsKey: string;
  mapId: string;
};

const VIEWS: View[] = ['home', 'itinerary', 'expenses', 'add', 'settle', 'stats', 'todos', 'settings'];

function readRoute(): Route {
  const p = new URLSearchParams(window.location.search);
  const v = p.get('v') as View | null;
  return { v: v && VIEWS.includes(v) ? v : 'home', id: p.get('id') ?? undefined };
}

const UNKNOWN: Member = { id: '', name: '已移除', color: 5, isOwner: false, claimed: false, sort: 0 };

export default function TripApp({ tripId, mapsKey, mapId }: { tripId: string; mapsKey: string; mapId: string }) {
  const store = useTrip(tripId);
  const [route, setRoute] = useState<Route>({ v: 'home' });

  useEffect(() => {
    setRoute(readRoute());
    const onPop = () => setRoute(readRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // 畫面切換只改網址參數，不向伺服器要新頁面，離線時也能切換
  const nav = useCallback((v: View, id?: string) => {
    const p = new URLSearchParams();
    if (v !== 'home') p.set('v', v);
    if (id) p.set('id', id);
    const qs = p.toString();
    window.history.pushState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
    setRoute({ v, id });
    window.scrollTo(0, 0);
  }, []);

  const { snap, queue } = store;

  const derived = useMemo(() => {
    if (!snap) return null;
    const known = new Set(snap.expenses.map((e) => e.id));
    const pending: Expense[] = queue
      .filter((e) => !known.has(e.id))
      .map((e) => ({ ...e, createdBy: snap.me.memberId, pending: true }));
    const expenses = [...pending, ...snap.expenses].sort((a, b) =>
      a.spentOn < b.spentOn ? 1 : a.spentOn > b.spentOn ? -1 : 0,
    );
    const rates = Object.fromEntries(snap.currencies.map((c) => [c.code, c.rate]));
    const ids = snap.members.map((m) => m.id);
    const settle = snap.trip.settleCurrency;
    return {
      expenses,
      rates,
      balances: computeBalances(ids, expenses, snap.payments, settle, rates),
      gross: computeBalances(ids, expenses, [], settle, rates),
    };
  }, [snap, queue]);

  if (store.status === 'denied') {
    return (
      <main className="app">
        <div className="body" style={{ justifyContent: 'center' }}>
          <h1 className="h1">打不開這趟旅程</h1>
          <p className="notice">
            這支手機還沒有加入這趟旅程，或是邀請連結已經被重置。請向旅程建立者索取最新的邀請連結，點開後選自己的名字就能加入。
          </p>
          <a className="btn soft" href="/">回到首頁</a>
        </div>
      </main>
    );
  }
  if (!snap || !derived) {
    return (
      <main className="app">
        <div className="body" style={{ justifyContent: 'center' }}>
          {store.status === 'error' ? (
            <>
              <p className="notice">現在連不上網路，而這支手機還沒有存過這趟旅程的資料。請連上網路後再試一次。</p>
              <button className="btn blue" onClick={() => void store.refresh()}>重新載入</button>
            </>
          ) : (
            <p className="empty" role="status">載入中…</p>
          )}
        </div>
      </main>
    );
  }

  const byId = new Map(snap.members.map((m) => [m.id, m]));
  const ctx: Ctx = {
    snap,
    store,
    nav,
    route,
    me: byId.get(snap.me.memberId) ?? UNKNOWN,
    isOwner: snap.me.role === 'owner',
    member: (id) => byId.get(id) ?? UNKNOWN,
    ...derived,
    mapsKey,
    mapId,
  };

  const view: View = route.v === 'settings' && !ctx.isOwner ? 'home' : route.v;
  const showTabs = ['home', 'itinerary', 'expenses', 'todos'].includes(view);
  const tabs: { v: View; label: string; icon: string }[] = [
    { v: 'home', label: '總覽', icon: 'home' },
    { v: 'itinerary', label: '行程', icon: 'pin' },
    { v: 'expenses', label: '記帳', icon: 'wallet' },
    { v: 'todos', label: '待辦', icon: 'list' },
  ];

  return (
    <main className="app">
      {view === 'home' && <Overview ctx={ctx} />}
      {view === 'itinerary' && <Itinerary ctx={ctx} />}
      {view === 'expenses' && <Expenses ctx={ctx} />}
      {view === 'add' && <AddExpense ctx={ctx} key={route.id ?? 'new'} />}
      {view === 'settle' && <Settle ctx={ctx} />}
      {view === 'stats' && <Stats ctx={ctx} />}
      {view === 'todos' && <Todos ctx={ctx} />}
      {view === 'settings' && <Settings ctx={ctx} />}

      {showTabs && (
        <nav className="tabbar" aria-label="主選單">
          {tabs.slice(0, 2).map((t) => (
            <button key={t.v} className={`tab ${view === t.v ? 'on' : ''}`} aria-current={view === t.v ? 'page' : undefined} onClick={() => nav(t.v)}>
              <Icon name={t.icon} />
              {t.label}
            </button>
          ))}
          <div className="fab-slot">
            <button className="fab" aria-label="記一筆" onClick={() => nav('add')}>
              <Icon name="plus" size={28} stroke={2.5} />
            </button>
          </div>
          {tabs.slice(2).map((t) => (
            <button key={t.v} className={`tab ${view === t.v ? 'on' : ''}`} aria-current={view === t.v ? 'page' : undefined} onClick={() => nav(t.v)}>
              <Icon name={t.icon} />
              {t.label}
            </button>
          ))}
        </nav>
      )}
      {store.toast && <div className="toast" role="status">{store.toast}</div>}
    </main>
  );
}
