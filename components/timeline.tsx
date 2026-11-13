'use client';

// 時間軸相關的共用工具：天數航線、站點狀態（走過／下一站／之後）、現在時間。
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon, md, parseDate } from './ui';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

/** "HH:MM" 轉成當天的第幾分鐘 */
export const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function durLabel(m: number): string {
  const h = Math.floor(m / 60);
  const r = m % 60;
  return [h ? `${h} 小時` : '', r ? `${r} 分` : ''].filter(Boolean).join(' ');
}

/** 手機現在是當天的第幾分鐘，每半分鐘更新一次 */
export function useNow(): number {
  const read = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };
  const [m, setM] = useState(read);
  useEffect(() => {
    const id = window.setInterval(() => setM(read()), 30000);
    return () => window.clearInterval(id);
  }, []);
  return m;
}

/** 量出容器寬度，讓路線圖與金流圖能照實際寬度畫 */
export function useWidth<T extends HTMLElement>(fallback = 350) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth || fallback);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, w] as const;
}

export type StopStatus = 'done' | 'next' | 'later';
export type StopStates = {
  status: StopStatus[];
  /** 「現在」落在第 after 站與下一站之間，frac 是走了幾成 */
  marker: { after: number; frac: number } | null;
  /** 距離下一站還有幾分鐘 */
  untilNext: number | null;
};

/**
 * 依照時間判斷每一站的狀態。只有「今天」會分走過／下一站；
 * 過去的日子全部算走過，未來的日子全部算還沒到。沒填時間的站跟著前後的站走。
 */
export function stopStates(items: { time: string | null }[], day: string, today: string, now: number): StopStates {
  if (day !== today) {
    const s: StopStatus = day < today ? 'done' : 'later';
    return { status: items.map(() => s), marker: null, untilNext: null };
  }
  const t = items.map((i) => (i.time ? mins(i.time) : null));
  let last = -1;
  t.forEach((v, i) => {
    if (v !== null && v <= now) last = i;
  });
  let next = -1;
  for (let i = last + 1; i < t.length; i++) {
    const v = t[i];
    if (v !== null && v > now) {
      next = i;
      break;
    }
  }
  const status = t.map((v, i): StopStatus =>
    i === next ? 'next' : i <= last && (v === null || v <= now) ? 'done' : 'later',
  );
  const a = last >= 0 ? t[last] : null;
  const b = next >= 0 ? t[next] : null;
  const marker =
    a !== null && b !== null && next === last + 1 ? { after: last, frac: (now - a) / (b - a) } : null;
  return { status, marker, untilNext: b !== null ? b - now : null };
}

/** 天數航線：每一天是一個點，選到的那天變成太陽 */
export function DayRibbon({
  days,
  selected,
  today,
  onPick,
  label,
}: {
  days: string[];
  selected: string;
  today: string;
  onPick: (day: string) => void;
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const cur = useRef<HTMLButtonElement>(null);

  // 天數多到要橫向捲動時，把選到的那天捲到中間
  useEffect(() => {
    const b = box.current;
    const c = cur.current;
    if (b && c) b.scrollLeft = c.offsetLeft - (b.clientWidth - c.clientWidth) / 2;
  }, [selected]);

  return (
    <div className="ribbon" role="group" aria-label={label} ref={box}>
      {days.map((d, i) => {
        const on = d === selected;
        const past = d < today;
        const wd = WEEK[parseDate(d).getDay()];
        return (
          <button
            key={d}
            ref={on ? cur : undefined}
            className={`rb ${on ? 'on' : past ? 'past' : ''} ${d <= today ? 'reached' : ''}`}
            aria-pressed={on}
            aria-label={`第 ${i + 1} 天 ${md(d)} 週${wd}${d === today ? '，今天' : ''}`}
            onClick={() => onPick(d)}
          >
            <span className="rb-slot">
              <span className="rb-dot num">
                {on ? `D${i + 1}` : past ? <Icon name="check" size={13} stroke={3.4} /> : i + 1}
              </span>
            </span>
            <span>{d === today ? `今天・${wd}` : `${md(d)} ${wd}`}</span>
          </button>
        );
      })}
    </div>
  );
}
