// 把貼上的整份行程文字解析成一筆一筆的地點。伺服器與瀏覽器都不依賴外部套件，方便單元測試。
//
// 每行一站，用半形直線 | 分欄：
//   日期 時間 | 名稱 | 類別 | 備註 | 地圖搜尋字
// 只有「日期」和「名稱」必填。日期可寫 2026-11-30、11/30 或 D1；地圖搜尋字寫 - 代表不放圖釘。

export type PlanRow = {
  line: number;
  day: string;
  time: string | null;
  name: string;
  category: string;
  note: string;
  /** 用來找位置的搜尋字；null 代表不找位置 */
  query: string | null;
};

export type PlanError = { line: number; text: string; reason: string };

const KIND_WORDS: Record<string, string> = {
  景點: 'sight', sight: 'sight',
  餐廳: 'food', 美食: 'food', 吃: 'food', food: 'food',
  交通: 'transit', 航班: 'transit', transit: 'transit',
  住宿: 'stay', stay: 'stay',
  購物: 'shopping', shopping: 'shopping',
  其他: 'other', other: 'other',
};

const pad = (n: number | string) => String(n).padStart(2, '0');

function parseWhen(raw: string, days: string[]): { day: string; time: string | null } | string {
  const tokens = raw.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '缺少日期';
  if (tokens.length > 2) return '日期與時間寫法看不懂';
  const [d, t] = tokens;

  let day: string | undefined;
  let m: RegExpMatchArray | null;
  if ((m = d.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/))) {
    day = `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  } else if ((m = d.match(/^(\d{1,2})\/(\d{1,2})$/))) {
    const tail = `-${pad(m[1])}-${pad(m[2])}`;
    day = days.find((x) => x.endsWith(tail)) ?? `0000${tail}`;
  } else if ((m = d.match(/^[Dd](\d{1,2})$/))) {
    day = days[Number(m[1]) - 1] ?? '0000-00-00';
  } else {
    return `日期「${d}」看不懂`;
  }
  if (!days.includes(day)) return `日期「${d}」不在旅程期間內`;

  let time: string | null = null;
  if (t !== undefined) {
    m = t.match(/^(\d{1,2})[:：](\d{2})$/);
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return `時間「${t}」看不懂`;
    time = `${pad(m[1])}:${m[2]}`;
  }
  return { day, time };
}

export function parsePlan(text: string, days: string[]): { rows: PlanRow[]; errors: PlanError[] } {
  const rows: PlanRow[] = [];
  const errors: PlanError[] = [];
  text.split(/\r?\n/).forEach((rawLine, idx) => {
    const line = idx + 1;
    const src = rawLine.trim();
    if (!src || src.startsWith('#')) return;
    const bad = (reason: string) => errors.push({ line, text: src.slice(0, 40), reason });

    const parts = src.split('|').map((p) => p.trim());
    if (parts.length < 2) return bad('要用 | 分開日期和名稱');
    if (parts.length > 5) return bad('欄位太多，最多五欄');
    const [when, name, kind = '', note = '', query = ''] = parts;

    const w = parseWhen(when, days);
    if (typeof w === 'string') return bad(w);
    if (!name) return bad('缺少名稱');
    if (name.length > 80) return bad('名稱超過 80 個字');
    const category = kind ? KIND_WORDS[kind.toLowerCase()] : 'sight';
    if (!category) return bad(`類別「${kind}」看不懂`);

    rows.push({
      line,
      day: w.day,
      time: w.time,
      name,
      category,
      note: note.slice(0, 200),
      query: query === '-' ? null : query || name,
    });
  });
  return { rows, errors };
}

/** 同一天、同名稱的地點視為已存在，重複匯入時略過 */
export function splitExisting<T extends { day: string; name: string }>(
  rows: T[],
  existing: { day: string; name: string }[],
): { fresh: T[]; dup: T[] } {
  const seen = new Set(existing.map((e) => `${e.day}|${e.name.trim()}`));
  const fresh: T[] = [];
  const dup: T[] = [];
  for (const r of rows) {
    const key = `${r.day}|${r.name}`;
    if (seen.has(key)) dup.push(r);
    else {
      seen.add(key);
      fresh.push(r);
    }
  }
  return { fresh, dup };
}
