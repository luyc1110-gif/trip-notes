'use client';

import { useMemo, useRef, useState } from 'react';
import { parsePlan, splitExisting, type PlanRow } from '@/lib/importPlan';
import type { ItineraryItem } from '@/lib/types';
import type { Ctx } from '../TripApp';
import { findPlace } from '../MapView';
import { Icon, md } from '../ui';

type Item = Omit<ItineraryItem, 'id' | 'sort'>;
type Located = { row: PlanRow; item: Item };

const EXAMPLE = [
  '11/30 15:00 | 午餐：Suage+ 湯咖哩 | 餐廳 | 辣度可選 | Suage+ 本店 札幌',
  '11/30 16:00 | 狸小路商店街 | 購物',
  'D2 | 小樽運河',
].join('\n');

/** 貼上整份行程，一次匯入多站 */
export default function ImportSheet({ ctx, days, onClose }: { ctx: Ctx; days: string[]; onClose: () => void }) {
  const { store, snap, mapsKey } = ctx;
  const [text, setText] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [pending, setPending] = useState<{ items: Item[]; missing: string[]; apiError: boolean } | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => {
    const { rows, errors } = parsePlan(text, days);
    const { fresh, dup } = splitExisting(rows, snap.itinerary);
    const perDay = days
      .map((d, i) => ({ label: 'D' + (i + 1), n: fresh.filter((r) => r.day === d).length }))
      .filter((x) => x.n > 0);
    return { fresh, dup, errors, perDay };
  }, [text, days, snap.itinerary]);

  const working = progress !== null || store.busy;
  const count = parsed.fresh.length;

  async function readFile(f: File | undefined) {
    if (!f) return;
    setText(await f.text());
    setPending(null);
  }

  async function send(items: Item[]) {
    const ok = await store.act({ op: 'itinerary.import', items });
    if (ok) {
      store.notify('已匯入 ' + items.length + ' 站行程');
      onClose();
    }
  }

  async function start() {
    const out: Located[] = parsed.fresh.map((row) => ({
      row,
      item: { day: row.day, time: row.time, name: row.name, category: row.category, note: row.note, placeId: null, lat: null, lng: null },
    }));
    const todo = mapsKey ? out.filter((x) => x.row.query) : [];
    const missing: string[] = [];
    let apiError = false;

    if (todo.length > 0) {
      setProgress({ done: 0, total: todo.length });
      let next = 0;
      let done = 0;
      // 同時最多找四個，避免一次送出太多查詢
      const worker = async () => {
        while (next < todo.length) {
          const cur = todo[next++];
          try {
            const hit = await findPlace(mapsKey, cur.row.query as string);
            if (hit) Object.assign(cur.item, hit);
            else missing.push(cur.row.name);
          } catch {
            apiError = true;
            missing.push(cur.row.name);
          }
          setProgress({ done: ++done, total: todo.length });
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      setProgress(null);
    }

    const items = out.map((x) => x.item);
    if (missing.length > 0) setPending({ items, missing, apiError });
    else await send(items);
  }

  const buttonText = progress
    ? '正在找位置 ' + progress.done + ' / ' + progress.total
    : store.busy
      ? '匯入中…'
      : count === 0
        ? '匯入'
        : mapsKey
          ? '找位置並匯入 ' + count + ' 站'
          : '匯入 ' + count + ' 站';

  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && !working && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="匯入整份行程">
        <div className="row spread">
          <h2 className="h2">匯入整份行程</h2>
          <button className="icon-btn" aria-label="關閉" onClick={onClose} disabled={working}>
            <Icon name="close" stroke={2.2} />
          </button>
        </div>

        {pending ? (
          <>
            <p className="sm">
              {pending.apiError
                ? 'Google 地點搜尋發生錯誤，可能是金鑰或 API 的設定問題。'
                : '有 ' + pending.missing.length + ' 站在 Google 地圖上找不到位置。'}
              照樣匯入的話，這些站只會出現在清單裡、地圖上沒有圖釘，之後可以按鉛筆重新搜尋。
            </p>
            <ul className="imp-list">
              {pending.missing.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
            <button className="btn primary" onClick={() => send(pending.items)} disabled={store.busy}>
              {store.busy ? '匯入中…' : '照樣匯入 ' + pending.items.length + ' 站'}
            </button>
            <button className="btn link" onClick={() => setPending(null)} disabled={store.busy}>
              回去修改
            </button>
          </>
        ) : (
          <>
            <div className="field">
              <label className="label" htmlFor="imp-text">
                每行一站：日期 時間 | 名稱 | 類別 | 備註 | 地圖搜尋字（只有日期和名稱必填）
              </label>
              <textarea
                id="imp-text"
                className="input imp-text"
                rows={8}
                placeholder={EXAMPLE}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={working}
              />
              <div className="sub">
                日期可寫 11/30、2026-11-30 或 D1。類別：景點、餐廳、交通、住宿、購物、其他。地圖搜尋字不填就用名稱找，填 - 代表不放圖釘。
              </div>
            </div>

            <input ref={file} type="file" accept=".txt,.md,text/plain,text/markdown" hidden onChange={(e) => readFile(e.target.files?.[0])} />
            <button className="btn soft" onClick={() => file.current?.click()} disabled={working}>
              從檔案讀取
            </button>

            {text.trim() && (
              <div className="imp-summary" role="status">
                <div>
                  可匯入 <b className="num-sm">{count}</b> 站
                  {parsed.perDay.length > 0 && (
                    <span className="sub">　{parsed.perDay.map((d) => d.label + ' ' + d.n).join('・')}</span>
                  )}
                </div>
                {count > 0 && (
                  <div className="sub">
                    {md(parsed.fresh[0].day)} 起，共 {new Set(parsed.fresh.map((r) => r.day)).size} 天
                  </div>
                )}
                {parsed.dup.length > 0 && <div className="sub">另有 {parsed.dup.length} 站已經在行程裡，會略過。</div>}
                {parsed.errors.length > 0 && (
                  <>
                    <div className="neg sm">有 {parsed.errors.length} 行看不懂，不會匯入：</div>
                    <ul className="imp-list">
                      {parsed.errors.slice(0, 20).map((e) => (
                        <li key={e.line}>
                          第 {e.line} 行「{e.text}」：{e.reason}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {!store.online && <p className="neg sm">目前離線，匯入需要連上網路。</p>}
            <button className="btn primary" onClick={start} disabled={working || count === 0 || !store.online}>
              {buttonText}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
