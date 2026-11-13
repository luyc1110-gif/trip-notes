'use client';

import { CURRENCIES, formatMoney, symbolOf } from '@/lib/money';
import { PLACE_KINDS } from '@/lib/types';
import type { Ctx } from '../TripApp';
import { Scene } from '../Scenes';
import { Icon, daysUntil, md, todayIso, tripDays } from '../ui';

export default function Overview({ ctx }: { ctx: Ctx }) {
  const { snap, nav, me, balances } = ctx;
  const { trip } = snap;
  const today = todayIso();
  const days = tripDays(trip.startDate, trip.endDate);
  const inTrip = today >= trip.startDate && today <= trip.endDate;

  const phase = inTrip
    ? `第 ${days.indexOf(today) + 1} 天・共 ${days.length} 天`
    : today < trip.startDate
      ? `還有 ${daysUntil(today, trip.startDate)} 天出發`
      : '旅程已結束';

  const showDay = inTrip ? today : trip.startDate;
  const items = snap.itinerary.filter((i) => i.day === showDay);
  const net = balances.net[me.id] ?? 0;
  const settle = trip.settleCurrency;
  const kind = (key: string) => PLACE_KINDS.find((k) => k.key === key)?.label ?? '其他';

  return (
    <div className="screen">
      <header className="hero">
        <Scene kind={trip.cover} />
        <div className="hero-text">
          <div className="meta">{phase}</div>
          <h1>{trip.name}</h1>
          <div className="meta num-sm">
            {md(trip.startDate)} – {md(trip.endDate)}・{snap.members.length} 人同行
          </div>
        </div>
        {ctx.isOwner && (
          <div className="hero-action row" style={{ gap: 8 }}>
            <a className="icon-btn glass" href="/" aria-label="回到我的旅程">
              <Icon name="trips" />
            </a>
            <button className="icon-btn glass" aria-label="旅程設定" onClick={() => nav('settings')}>
              <Icon name="gear" />
            </button>
          </div>
        )}
      </header>

      <div className="body with-tabs" style={{ gap: 18, paddingTop: 0 }}>
        <section className="card raised lift" aria-label="帳務摘要">
          <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
            <div className="grow">
              <div className="label">{net > 0 ? '你目前應收' : net < 0 ? '你目前應付' : '你目前沒有欠款'}</div>
              <div className={`num ${net > 0 ? 'pos' : net < 0 ? 'neg' : ''}`} style={{ fontSize: 26 }}>
                {net > 0 ? '+' : net < 0 ? '−' : ''}
                {formatMoney(Math.abs(net), settle)}
              </div>
            </div>
            <div className="divider" />
            <div className="grow">
              <div className="label">旅程總花費</div>
              <div className="num" style={{ fontSize: 26 }}>{formatMoney(balances.total, settle)}</div>
            </div>
          </div>
          <div className="sub">
            我是{me.name}・以{CURRENCIES[settle]?.name ?? settle}結算
            {snap.currencies.map((c) => `・${symbolOf(c.code)}1 = ${symbolOf(settle)}${c.rate}`).join('')}
          </div>
        </section>

        <section className="stack" style={{ gap: 6 }}>
          <div className="row spread">
            <h2 className="h2">{inTrip ? '今日行程' : `第 1 天行程・${md(trip.startDate)}`}</h2>
            <button className="btn link" onClick={() => nav('itinerary')}>
              看地圖
              <Icon name="chevR" size={18} />
            </button>
          </div>
          {items.length === 0 ? (
            <p className="empty">這一天還沒有安排。到「行程」新增想去的地點吧。</p>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {items.map((it, i) => (
                <div className="item" key={it.id}>
                  <span className="badge num">{i + 1}</span>
                  <div className="grow">
                    <div className="ellipsis">{it.name}</div>
                    <div className="sub ellipsis">
                      {kind(it.category)}
                      {it.note ? `・${it.note}` : ''}
                    </div>
                  </div>
                  {it.time && <div className="num-sm" style={{ fontSize: 15, color: 'var(--ink2)' }}>{it.time}</div>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
