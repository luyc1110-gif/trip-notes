'use client';

import { CURRENCIES, formatAmount, formatMoney, planTransfers, symbolOf } from '@/lib/money';
import { PLACE_KINDS, type ItineraryItem } from '@/lib/types';
import type { Ctx } from '../TripApp';
import { Scene } from '../Scenes';
import { DayRibbon, durLabel, hhmm, stopStates, useNow, useWidth, type StopStates } from '../timeline';
import { Icon, daysUntil, md, todayIso, tripDays } from '../ui';

const kind = (key: string) => PLACE_KINDS.find((k) => k.key === key)?.label ?? '其他';

export default function Overview({ ctx }: { ctx: Ctx }) {
  const { snap, nav, me, balances, member } = ctx;
  const { trip } = snap;
  const today = todayIso();
  const now = useNow();
  const days = tripDays(trip.startDate, trip.endDate);
  const inTrip = today >= trip.startDate && today <= trip.endDate;

  const phase = inTrip
    ? `第 ${days.indexOf(today) + 1} 天・共 ${days.length} 天`
    : today < trip.startDate
      ? `還有 ${daysUntil(today, trip.startDate)} 天出發`
      : '旅程已結束';

  const showDay = inTrip ? today : trip.startDate;
  const items = snap.itinerary.filter((i) => i.day === showDay);
  const states = stopStates(items, showDay, today, now);

  const net = balances.net[me.id] ?? 0;
  const settle = trip.settleCurrency;
  // 跟我有關的轉帳：我應收時是「誰要給我」，我應付時是「我要給誰」
  const mine = planTransfers(balances.net)
    .filter((t) => (net > 0 ? t.toId === me.id : t.fromId === me.id))
    .map((t) => ({ who: member(net > 0 ? t.fromId : t.toId), amount: t.amountMinor }));

  return (
    <div className="screen">
      <header className="hero short">
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

      <DayRibbon days={days} selected={showDay} today={today} onPick={(d) => nav('itinerary', d)} label="旅程天數，點一天看那天的行程" />

      <div className="body with-tabs" style={{ gap: 18, paddingTop: 4 }}>
        <section className="stack" style={{ gap: 0 }}>
          <div className="row spread">
            <h2 className="h2">{inTrip ? '今天的路線' : `第 1 天的路線・${md(trip.startDate)}`}</h2>
            <button className="btn link" onClick={() => nav('itinerary', showDay)}>
              整天時間軸
              <Icon name="chevR" size={18} />
            </button>
          </div>
          {items.length === 0 ? (
            <p className="empty">這一天還沒有安排。到「行程」加上想去的地點吧。</p>
          ) : (
            <RouteMap items={items} states={states} now={now} />
          )}
        </section>

        <button className="owe" onClick={() => nav(net === 0 ? 'expenses' : 'settle')}>
          <span className="row" style={{ gap: 8, alignItems: 'baseline' }}>
            <span className="label">{net > 0 ? '大家還欠你' : net < 0 ? '你還要付' : '你目前沒有欠款'}</span>
            {net !== 0 && (
              <span className={`num ${net > 0 ? 'pos' : 'neg'}`} style={{ fontSize: 24 }}>
                {formatMoney(Math.abs(net), settle)}
              </span>
            )}
            <span className="grow" />
            <span className="row sm pos" style={{ gap: 2 }}>
              {net === 0 ? '看帳本' : '去結算'}
              <Icon name="chevR" size={18} />
            </span>
          </span>
          {mine.length > 0 && (
            <>
              <span className="owe-bar" aria-hidden="true">
                {mine.map((t) => (
                  <span key={t.who.id} className={`c${t.who.color % 8}`} style={{ flex: `${t.amount} 1 0` }} />
                ))}
              </span>
              <span className="owe-legend">
                {mine.map((t) => (
                  <span key={t.who.id} className="row" style={{ gap: 5 }}>
                    <i className={`c${t.who.color % 8}`} />
                    {t.who.name}
                    <b className="num-sm">{formatAmount(t.amount, settle)}</b>
                  </span>
                ))}
              </span>
            </>
          )}
          <span className="sub">
            旅程總花費 {formatMoney(balances.total, settle)}・我是{me.name}・以{CURRENCIES[settle]?.name ?? settle}結算
            {snap.currencies.map((c) => `・${symbolOf(c.code)}1 = ${symbolOf(settle)}${c.rate}`).join('')}
          </span>
        </button>
      </div>
    </div>
  );
}

// ── 今天的路線：一條左右蜿蜒的小路，每一站輪流落在左、右兩側 ──────────

type Pt = { x: number; y: number };
const STEP = 120; // 相鄰兩站的垂直距離
const TOP = 34;
const EDGE = 44; // 站點離左右邊界的距離
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const f = (n: number) => Math.round(n * 10) / 10;
const curve = (c: Pt[]) => `M${f(c[0].x)} ${f(c[0].y)} C${f(c[1].x)} ${f(c[1].y)} ${f(c[2].x)} ${f(c[2].y)} ${f(c[3].x)} ${f(c[3].y)}`;

/** 把一段貝茲曲線在 t 的位置切開，回傳前半段與切點 */
function splitAt(c: Pt[], t: number): { head: Pt[]; point: Pt } {
  const a = lerp(c[0], c[1], t);
  const b = lerp(c[1], c[2], t);
  const d = lerp(c[2], c[3], t);
  const e = lerp(a, b, t);
  const g = lerp(b, d, t);
  const point = lerp(e, g, t);
  return { head: [c[0], a, e, point], point };
}

function RouteMap({ items, states, now }: { items: ItineraryItem[]; states: StopStates; now: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const pts = items.map((_, i) => ({ x: i % 2 === 0 ? EDGE : w - EDGE, y: TOP + i * STEP }));
  const height = TOP + (items.length - 1) * STEP + 50;
  // 每一段都從站點垂直離開、垂直抵達，中間橫掃到另一側
  const segs = pts.slice(1).map((b, i) => {
    const a = pts[i];
    return [a, { x: a.x, y: a.y + STEP * 0.6 }, { x: b.x, y: b.y - STEP * 0.6 }, b];
  });
  const road = segs.map(curve).join(' ');

  const walked: string[] = [];
  let here: Pt | null = null;
  segs.forEach((c, i) => {
    if (states.marker?.after === i) {
      const cut = splitAt(c, Math.min(0.75, Math.max(0.25, states.marker.frac)));
      walked.push(curve(cut.head));
      here = cut.point;
    } else if (states.status[i] === 'done' && states.status[i + 1] === 'done') {
      walked.push(curve(c));
    }
  });
  const marker = here as Pt | null;

  return (
    <div className="route" ref={ref} style={{ height }}>
      <svg aria-hidden="true" width={w} height={height} viewBox={`0 0 ${w} ${height}`}>
        {road && (
          <>
            <path d={road} fill="none" stroke="#DCE6E2" strokeWidth="17" strokeLinecap="round" />
            <path d={road} fill="none" stroke="#FFFFFF" strokeWidth="12" strokeLinecap="round" />
            <path d={road} fill="none" stroke="#B9C9C3" strokeWidth="2" strokeDasharray="1 8" strokeLinecap="round" />
          </>
        )}
        {walked.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="#4F8A3C" strokeWidth="5" strokeLinecap="round" />
        ))}
        {/* 每一段路的空角落種一棵花樹 */}
        {segs.map((_, i) => {
          const x = i % 2 === 0 ? w - EDGE + 6 : EDGE - 6;
          const y = pts[i].y + 26;
          const s = i % 2 === 0 ? 1 : -1;
          return (
            <g key={i}>
              <path d={`M${x} ${y + 8} v12`} stroke="#1F4E5F" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx={x - 4 * s} cy={y} r="11" fill="#F3B9C2" />
              <circle cx={x + 8 * s} cy={y - 6} r="8" fill="#F3B9C2" />
            </g>
          );
        })}
      </svg>

      {items.map((it, i) => {
        const st = states.status[i];
        const left = i % 2 === 0;
        const p = pts[i];
        return (
          <div key={it.id}>
            <span className={`rt-node num ${st}`} style={{ left: p.x, top: p.y }}>
              {st === 'done' ? <Icon name="check" size={18} stroke={3} /> : i + 1}
            </span>
            <div
              className={`rt-label ${left ? '' : 'r'} ${st}`}
              style={left ? { left: p.x + 34, right: EDGE + 30, top: p.y } : { right: w - p.x + 34, left: EDGE + 30, top: p.y }}
            >
              {st === 'next' && (
                <span className="tag-next">
                  下一站{states.untilNext ? `・再 ${durLabel(states.untilNext)}` : ''}
                </span>
              )}
              <span className="rt-line">
                {it.time && <span className="rt-time num-sm">{it.time}</span>}
                <span className="rt-name ellipsis">{it.name}</span>
              </span>
              <span className="sub ellipsis">
                {st === 'done' ? '已走過・' : ''}
                {kind(it.category)}
                {it.note ? `・${it.note}` : ''}
              </span>
            </div>
          </div>
        );
      })}

      {marker && (
        <>
          <span className="now-pill rt-now" style={{ left: marker.x, top: marker.y - 14 }}>
            現在 <b className="num-sm">{hhmm(now)}</b>
          </span>
          <span className="rt-pulse" style={{ left: marker.x, top: marker.y }} />
          <span className="rt-here" style={{ left: marker.x, top: marker.y }} />
        </>
      )}
    </div>
  );
}
