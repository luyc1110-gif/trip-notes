'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PLACE_KINDS, type ItineraryItem } from '@/lib/types';
import type { Ctx } from '../TripApp';
import MapView, { searchPlaces, type PlaceHit } from '../MapView';
import { Grip, Icon, md, todayIso, tripDays } from '../ui';

const ROW_H = 68; // 每列 60px 加上 8px 間距
const kindLabel = (key: string) => PLACE_KINDS.find((k) => k.key === key)?.label ?? '其他';

function navUrl(it: ItineraryItem): string {
  if (it.lat !== null && it.lng !== null) {
    const pid = it.placeId ? `&destination_place_id=${encodeURIComponent(it.placeId)}` : '';
    return `https://www.google.com/maps/dir/?api=1&destination=${it.lat},${it.lng}${pid}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(it.name)}`;
}

type Draft = Omit<ItineraryItem, 'id' | 'sort'>;

export default function Itinerary({ ctx }: { ctx: Ctx }) {
  const { snap, store, mapsKey, mapId } = ctx;
  const { trip } = snap;
  const days = useMemo(() => tripDays(trip.startDate, trip.endDate), [trip.startDate, trip.endDate]);
  const today = todayIso();
  const [day, setDay] = useState(days.includes(today) ? today : days[0]);
  const [sheet, setSheet] = useState<{ item?: ItineraryItem } | null>(null);

  const dayItems = useMemo(() => snap.itinerary.filter((i) => i.day === day), [snap.itinerary, day]);

  // 拖曳中先在畫面上即時換位置，放開後才送出新的順序
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const drag = useRef<{ id: string; startY: number; startIdx: number; ids: string[]; cur: string[] } | null>(null);
  const list = order
    ? (order.map((id) => dayItems.find((i) => i.id === id)).filter(Boolean) as ItineraryItem[])
    : dayItems;

  async function commit(ids: string[]) {
    await store.act({ op: 'itinerary.reorder', day, ids });
    setOrder(null);
  }

  function onGripDown(e: React.PointerEvent<HTMLButtonElement>, id: string, idx: number) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ids = list.map((i) => i.id);
    drag.current = { id, startY: e.clientY, startIdx: idx, ids, cur: ids };
    setOrder(ids);
    setDragId(id);
  }
  function onGripMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    const target = Math.max(0, Math.min(d.ids.length - 1, d.startIdx + Math.round((e.clientY - d.startY) / ROW_H)));
    const next = d.ids.filter((x) => x !== d.id);
    next.splice(target, 0, d.id);
    d.cur = next;
    setOrder(next);
  }
  function onGripUp() {
    const d = drag.current;
    drag.current = null;
    setDragId(null);
    if (!d) return;
    if (d.cur.join() !== d.ids.join()) void commit(d.cur);
    else setOrder(null);
  }
  function onGripKey(e: React.KeyboardEvent, idx: number) {
    const delta = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
    const to = idx + delta;
    if (!delta || to < 0 || to >= list.length) return;
    e.preventDefault();
    const ids = list.map((i) => i.id);
    [ids[idx], ids[to]] = [ids[to], ids[idx]];
    setOrder(ids);
    void commit(ids);
  }

  const points = list
    .map((it, i) => ({ it, label: String(i + 1) }))
    .filter(({ it }) => it.lat !== null && it.lng !== null)
    .map(({ it, label }) => ({ lat: it.lat as number, lng: it.lng as number, label, title: it.name }));

  return (
    <div className="screen">
      <div className="body with-tabs" style={{ gap: 12, paddingTop: 20 }}>
        <div className="row spread" style={{ alignItems: 'baseline' }}>
          <h1 className="h1">行程</h1>
          <div className="sm muted ellipsis">{trip.name}</div>
        </div>

        <div className="days" role="group" aria-label="選擇日期">
          {days.map((d, i) => (
            <button key={d} className={`chip day ${d === day ? 'on' : ''}`} aria-pressed={d === day} onClick={() => { setDay(d); setOrder(null); }}>
              <span className="num">D{i + 1}</span>
              <span className="d num-sm">{md(d)}</span>
            </button>
          ))}
        </div>

        <MapView points={points} mapsKey={mapsKey} mapId={mapId} />

        {list.length === 0 ? (
          <p className="empty">這一天還沒有安排地點。</p>
        ) : (
          <div className="stack">
            {list.map((it, i) => (
              <div className={`place ${dragId === it.id ? 'dragging' : ''}`} key={it.id}>
                <button
                  className="grip"
                  aria-label={`調整「${it.name}」的順序，可用上下方向鍵`}
                  onPointerDown={(e) => onGripDown(e, it.id, i)}
                  onPointerMove={onGripMove}
                  onPointerUp={onGripUp}
                  onPointerCancel={onGripUp}
                  onKeyDown={(e) => onGripKey(e, i)}
                >
                  <Grip />
                </button>
                <span className="badge num">{i + 1}</span>
                <button className="place-main" onClick={() => setSheet({ item: it })} aria-label={`編輯 ${it.name}`}>
                  <span className="ellipsis">{it.name}</span>
                  <span className="sub ellipsis">
                    {it.time ? `${it.time}・` : ''}
                    {kindLabel(it.category)}
                    {it.note ? `・${it.note}` : ''}
                  </span>
                </button>
                <a className="icon-btn soft" href={navUrl(it)} target="_blank" rel="noopener noreferrer" aria-label={`用 Google 地圖導航到${it.name}`}>
                  <Icon name="nav" size={20} />
                </a>
              </div>
            ))}
          </div>
        )}

        <button className="btn dashed" onClick={() => setSheet({})}>
          <Icon name="plus" size={20} stroke={2.2} />
          {mapsKey ? '搜尋並新增地點' : '新增地點'}
        </button>
      </div>

      {sheet && <PlaceSheet ctx={ctx} day={day} days={days} item={sheet.item} onClose={() => setSheet(null)} />}
    </div>
  );
}

function PlaceSheet({ ctx, day, days, item, onClose }: { ctx: Ctx; day: string; days: string[]; item?: ItineraryItem; onClose: () => void }) {
  const { store, mapsKey } = ctx;
  const [draft, setDraft] = useState<Draft>(
    item
      ? { day: item.day, time: item.time, name: item.name, category: item.category, note: item.note, placeId: item.placeId, lat: item.lat, lng: item.lng }
      : { day, time: null, name: '', category: 'sight', note: '', placeId: null, lat: null, lng: null },
  );
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [error, setError] = useState('');
  const token = useRef<unknown>(null);
  const skipSearch = useRef(Boolean(item));

  // 輸入名稱時搜尋 Google 地點（有設定金鑰才會啟用）
  useEffect(() => {
    if (!mapsKey || skipSearch.current || draft.name.trim().length < 2) {
      setHits([]);
      return;
    }
    const timer = window.setTimeout(() => {
      searchPlaces(mapsKey, draft.name.trim(), token)
        .then(setHits)
        .catch(() => setHits([]));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft.name, mapsKey]);

  async function pick(hit: PlaceHit) {
    skipSearch.current = true;
    setHits([]);
    try {
      const p = await hit.pick();
      setDraft((d) => ({ ...d, name: p.name, lat: p.lat, lng: p.lng, placeId: p.placeId }));
    } catch {
      setDraft((d) => ({ ...d, name: hit.label }));
      store.notify('取得地點位置失敗，已只帶入名稱');
    }
  }

  async function save() {
    if (!draft.name.trim()) return setError('請填寫地點名稱');
    setError('');
    const ok = item
      ? await store.act({ op: 'itinerary.update', id: item.id, item: draft })
      : await store.act({ op: 'itinerary.add', item: draft });
    if (ok) onClose();
  }

  async function remove() {
    if (!item || !window.confirm(`確定要從行程移除「${item.name}」嗎？`)) return;
    if (await store.act({ op: 'itinerary.delete', id: item.id })) onClose();
  }

  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={item ? '編輯地點' : '新增地點'}>
        <div className="row spread">
          <h2 className="h2">{item ? '編輯地點' : '新增地點'}</h2>
          <button className="icon-btn" aria-label="關閉" onClick={onClose}>
            <Icon name="close" stroke={2.2} />
          </button>
        </div>

        <div className="field">
          <label className="label" htmlFor="place-name">{mapsKey ? '地點名稱（輸入後可從搜尋結果選取）' : '地點名稱'}</label>
          <input
            id="place-name"
            className="input"
            maxLength={80}
            placeholder="例如：清水寺"
            value={draft.name}
            onChange={(e) => {
              skipSearch.current = false;
              setDraft({ ...draft, name: e.target.value });
            }}
          />
          {hits.length > 0 && (
            <div className="suggest">
              {hits.map((h, i) => (
                <button key={i} onClick={() => pick(h)}>
                  <div>{h.label}</div>
                  {h.secondary && <div className="sub">{h.secondary}</div>}
                </button>
              ))}
            </div>
          )}
          <div className="sub">
            {draft.lat !== null ? '已取得位置，會顯示在當日地圖上。' : '還沒有位置資訊，只會出現在清單裡。'}
          </div>
        </div>

        <div className="row" style={{ gap: 10, alignItems: 'flex-end' }}>
          <div className="field grow">
            <label className="label" htmlFor="place-day">哪一天</label>
            <select id="place-day" className="input" value={draft.day} onChange={(e) => setDraft({ ...draft, day: e.target.value })}>
              {days.map((d, i) => (
                <option key={d} value={d}>
                  D{i + 1}・{md(d)}
                </option>
              ))}
            </select>
          </div>
          <div className="field grow">
            <label className="label" htmlFor="place-time">時間（可不填）</label>
            <input id="place-time" className="input" type="time" value={draft.time ?? ''} onChange={(e) => setDraft({ ...draft, time: e.target.value || null })} />
          </div>
        </div>

        <div className="field" role="group" aria-label="類別">
          <div className="label">類別</div>
          <div className="grid-auto">
            {PLACE_KINDS.map((k) => (
              <button key={k.key} className={`chip ${draft.category === k.key ? 'on' : ''}`} aria-pressed={draft.category === k.key} onClick={() => setDraft({ ...draft, category: k.key })}>
                {k.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="place-note">備註（可不填）</label>
          <input id="place-note" className="input" maxLength={200} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
        </div>

        {error && <p className="neg sm" role="alert">{error}</p>}
        <button className="btn primary" onClick={save} disabled={store.busy}>
          {store.busy ? '儲存中…' : '儲存'}
        </button>
        {item && (
          <button className="btn danger" onClick={remove} disabled={store.busy}>
            從行程移除
          </button>
        )}
      </div>
    </div>
  );
}
