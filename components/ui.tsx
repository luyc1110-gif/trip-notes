import type { ReactNode } from 'react';
import type { Member } from '@/lib/types';

const ICONS: Record<string, ReactNode> = {
  home: <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />,
  pin: (
    <>
      <path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" />
      <circle cx="12" cy="11" r="2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  wallet: (
    <>
      <path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M4 7V6a2 2 0 0 1 2-2h10" />
      <path d="M16 13h2" />
    </>
  ),
  list: (
    <>
      <path d="M10 6h10M10 12h10M10 18h10" />
      <path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />
    </>
  ),
  chevR: <path d="M9 6l6 6-6 6" />,
  chevL: <path d="M15 6l-6 6 6 6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  sync: (
    <>
      <path d="M4 12a8 8 0 0 1 14-5M20 12a8 8 0 0 1-14 5" />
      <path d="M18 3v4h-4M6 21v-4h4" />
    </>
  ),
  offline: (
    <>
      <path d="M3 3l18 18" />
      <path d="M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4-2.5M19 13a10 10 0 0 0-4.5-2.7" />
      <circle cx="12" cy="20" r="1" />
    </>
  ),
  food: <path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-3 5-3 8h3v10" />,
  transit: (
    <>
      <rect x="6" y="3" width="12" height="14" rx="3" />
      <path d="M6 11h12M9 21l1.5-4M15 21l-1.5-4" />
    </>
  ),
  stay: (
    <>
      <path d="M3 19v-8h13a4 4 0 0 1 4 4v4M3 15h17" />
      <circle cx="7.5" cy="8" r="1.5" />
    </>
  ),
  ticket: (
    <>
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
      <path d="M14 6v12" strokeDasharray="2 3" />
    </>
  ),
  shopping: (
    <>
      <path d="M6 8h12l1 12H5z" />
      <path d="M9 8V7a3 3 0 0 1 6 0v1" />
    </>
  ),
  other: (
    <>
      <circle cx="6" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="18" cy="12" r="1.3" />
    </>
  ),
  sight: (
    <>
      <path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" />
      <circle cx="12" cy="11" r="2" />
    </>
  ),
  check: <path d="M5 12l5 5 9-10" />,
  nav: <path d="M3 11l18-8-8 18-2-8z" />,
  arrow: <path d="M4 12h15M13 6l6 6-6 6" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </>
  ),
  trash: <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13M10 11v6M14 11v6" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  trips: (
    <>
      <rect x="4" y="5" width="16" height="6" rx="2" />
      <rect x="4" y="14" width="16" height="6" rx="2" />
    </>
  ),
};

export function Icon({ name, size = 24, stroke = 2 }: { name: string; size?: number; stroke?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name] ?? ICONS.other}
    </svg>
  );
}

export function Grip() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      {[6, 12, 18].map((y) => (
        <g key={y}>
          <circle cx="9" cy={y} r="1.8" />
          <circle cx="15" cy={y} r="1.8" />
        </g>
      ))}
    </svg>
  );
}

export function Avatar({ member, size }: { member: Pick<Member, 'name' | 'color'>; size?: 'sm' | 'lg' }) {
  const ch = member.name.trim().slice(-1) || '?';
  return (
    <span className={`avatar ${size ?? ''} c${member.color % 8}`} aria-hidden="true">
      {ch}
    </span>
  );
}

// ── 日期工具：一律用使用者手機的在地日期 ─────────────────────

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function todayIso(): string {
  return toIso(new Date());
}

export function md(iso: string): string {
  const d = parseDate(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function longDate(iso: string): string {
  const d = parseDate(iso);
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 週${WEEK[d.getDay()]}`;
}

export function tripDays(start: string, end: string): string[] {
  const out: string[] = [];
  const d = parseDate(start);
  const last = parseDate(end);
  // 上限 60 天，避免日期填錯時產生過長的清單
  while (d <= last && out.length < 60) {
    out.push(toIso(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function daysUntil(fromIso: string, toIsoStr: string): number {
  return Math.round((parseDate(toIsoStr).getTime() - parseDate(fromIso).getTime()) / 86400000);
}
