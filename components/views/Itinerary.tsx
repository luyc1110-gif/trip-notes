'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PLACE_KINDS, type ItineraryItem } from '@/lib/types';
import type { Ctx } from '../TripApp';
import MapView, { searchPlaces, type PlaceHit } from '../MapView';
import { DayRibbon, durLabel, hhmm, mins, stopStates, useNow } from '../timeline';
import { Grip, Icon, longDate, md, todayIso, tripDays } from '../ui';

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
  const { snap, store, mapsKey, mapId, route } = ctx;
  const { trip } = snap;
  const days = useMemo(() => tripDays(trip.startDate, trip.endDate), [trip.startDate, trip.endDate]);
  const today = todayIso();
  const now = useNow();
  // 從總覽的天數航線點進來時，網址會帶著要看的那一天
  const [day, setDay] = useState(
    route.id && days.includes(route.id) ? route.id : days.includes(today) ? today : days[0],
  );
  const [sheet, setSheet] = useState<{ item?: ItineraryItem } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const dayItems = useMemo(() => snap.itinerary.filter((i) => i.day === day), [snap.itinerary, day]);

  // 拖曳中先在畫面上即時換位置，放開後才送出新的順序
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLDivElement>());
  const drag = useRef<{ id: string; ids: string[]; cur: string[]; centers: Record<string, number> } | null>(null);
  const list = order
    ? (order.map((id) => dayItems.find((i) => i.id === id)).filter(Boolean) as ItineraryItem[])
    : dayItems;
  const states = stopStates(list, day, today, now);

  async function commit(ids: string[]) {
    await store.act({ op: 'itinerary.reorder', day, ids });
    setOrder(null);
  }

  function onGripDown(e: React.PointerEvent<HTMLButtonElement>, id: string) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ids = list.map((i) => i.id);
    // 每一站的間距不一樣高，所以記下拖曳開始時每一站的中心位置來判斷要插在哪裡
    const centers: Record<string, number> = {};
    for (const x of ids) {
      const r = rows.current.get(x)?.getBoundingClientRect();
      centers[x] = r ? r.top + r.height / 2 : 0;
    }
    drag.current = { id, ids, cur: ids, centers };
    setOrder(ids);
    setDragId(id);
  }
  function onGripMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    const others = d.ids.filter((x) => x !== d.id);
    const target = others.filter((x) => d.centers[x] < e.clientY).length;
    const next = [...others];
    next.splice(target, 0, d.id);
    if (next.join() === d.cur.join()) return;
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
      <div className="map-wrap">
        <MapView points={points} mapsKey={mapsKey} mapId={mapId} />
        <div className="map-title">
          <h1>行程</h1>
          <div className="sub">
            D{days.indexOf(day) + 1}・{longDate(day)}
            {day === today ? '・今天' : ''}
            {list.length ? `・${list.length} 站` : ''}
          </div>
        </div>
      </div>

      <DayRibbon
        days={days}
        selected={day}
        today={today}
        onPick={(d) => {
          setDay(d);
          setOrder(null);
          setOpenId(null);
        }}
        label="選擇哪一天"
      />

      <div className="body with-tabs" style={{ gap: 0, paddingTop: 6, paddingRight: 8 }}>
        <div className="tl">
          {list.length === 0 && <p className="tl-empty">這一天還沒有安排，先加第一站吧。</p>}

          {list.map((it, i) => {
            const st = states.status[i];
            const prev = list[i - 1];
            const diff = prev?.time && it.time ? mins(it.time) - mins(prev.time) : 0;
            // 兩站之間的距離照時間長短拉開，讓一天的鬆緊一眼看得出來
            const gap = diff > 0 ? Math.max(30, Math.min(84, Math.round((diff / 60) * 22))) : 24;
            const nowHere = states.marker?.after === i - 1;
            const open = openId === it.id;
            return (
              <div key={it.id} className={`tl-row ${st} ${dragId === it.id ? 'dragging' : ''}`}>
                {i > 0 && (
                  <div className="tl-gap" style={{ height: gap }}>
                    {nowHere ? (
                      <>
                        <span className="tl-now-dot" />
                        <span className="now-pill">
                          現在 <b className="num-sm">{hhmm(now)}</b>
                        </span>
                      </>
                    ) : (
                      diff > 0 && <span className="sub">隔 {durLabel(diff)}</span>
                    )}
                  </div>
                )}
                <div
                  className="tl-main"
                  ref={(el) => {
                    if (el) rows.current.set(it.id, el);
                    else rows.current.delete(it.id);
                  }}
                >
                  <div className="tl-time num-sm">{it.time ?? <span className="sub">未定</span>}</div>
                  <div className="tl-slot">
                    <span className="tl-node num">
                      {st === 'done' ? <Icon name="check" size={16} stroke={3.2} /> : i + 1}
                    </span>
                  </div>
                  <div className="tl-body">
                    <div className="tl-head">
                      <button className="tl-text" aria-expanded={open} onClick={() => setOpenId(open ? null : it.id)}>
                        <span className="tl-name">{it.name}</span>
                        <span className="sub">
                          {st === 'done' ? '已走過・' : st === 'next' ? '下一站・' : ''}
                          {kindLabel(it.category)}
                          {it.note ? `・${it.note}` : ''}
                        </span>
                      </button>
                      <button
                        className="grip"
                        aria-label={`調整「${it.name}」的順序，可用上下方向鍵`}
                        onPointerDown={(e) => onGripDown(e, it.id)}
                        onPointerMove={onGripMove}
                        onPointerUp={onGripUp}
                        onPointerCancel={onGripUp}
                        onKeyDown={(e) => onGripKey(e, i)}
                      >
                        <Grip />
                      </button>
                    </div>
                    {open && (
                      <div className="tl-actions">
                        <a href={navUrl(it)} target="_blank" rel="noopener noreferrer">
                          <Icon name="nav" size={18} />
                          帶我去
                        </a>
                        <button onClick={() => setSheet({ item: it })}>
                          <Icon name="edit" size={18} />
                          改時間或備註
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <button className="tl-add" onClick={() => setSheet({})}>
            <span className="tl-time" />
            <span className="tl-slot">
              <span className="tl-node add">
                <Icon name="plus" size={16} stroke={3} />
              </span>
            </span>
            <span>{mapsKey ? '搜尋並加一站' : '加一站'}</span>
          </button>
        </div>
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
