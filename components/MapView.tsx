'use client';

import { useEffect, useRef, useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
    __thMaps?: Promise<any>;
    __thMapsReady?: () => void;
  }
}

/** 載入 Google Maps JavaScript API（整個 App 只載一次） */
export function loadMaps(key: string): Promise<any> {
  if (window.__thMaps) return window.__thMaps;
  window.__thMaps = new Promise((resolve, reject) => {
    window.__thMapsReady = () => resolve(window.google.maps);
    const s = document.createElement('script');
    s.src =
      'https://maps.googleapis.com/maps/api/js?v=weekly&language=zh-TW&loading=async' +
      `&callback=__thMapsReady&key=${encodeURIComponent(key)}`;
    s.async = true;
    s.onerror = () => {
      window.__thMaps = undefined;
      reject(new Error('Google Maps 載入失敗'));
    };
    document.head.appendChild(s);
  });
  return window.__thMaps;
}

export type PlaceHit = {
  label: string;
  secondary: string;
  pick: () => Promise<{ name: string; lat: number; lng: number; placeId: string }>;
};

/** Places API (New) 的自動完成搜尋 */
export async function searchPlaces(key: string, input: string, token: { current: any }): Promise<PlaceHit[]> {
  const maps = await loadMaps(key);
  const lib = await maps.importLibrary('places');
  token.current ??= new lib.AutocompleteSessionToken();
  const { suggestions } = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input,
    language: 'zh-TW',
    sessionToken: token.current,
  });
  return (suggestions as any[])
    .filter((s) => s.placePrediction)
    .slice(0, 5)
    .map((s) => {
      const p = s.placePrediction;
      const label: string = p.mainText?.text ?? p.text?.text ?? '';
      return {
        label,
        secondary: p.secondaryText?.text ?? '',
        pick: async () => {
          const place = p.toPlace();
          await place.fetchFields({ fields: ['displayName', 'location'] });
          token.current = null; // 選定地點後這次搜尋工作階段結束
          return {
            name: place.displayName ?? label,
            lat: place.location.lat(),
            lng: place.location.lng(),
            placeId: place.id,
          };
        },
      };
    });
}

export type MapPoint = { lat: number; lng: number; label: string; title: string };

function Placeholder() {
  return (
    <svg aria-hidden="true" viewBox="0 0 350 210" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <rect width="350" height="210" fill="#E6EFE4" />
      <rect x="0" y="0" width="58" height="46" fill="#C9E2BE" />
      <rect x="158" y="126" width="74" height="44" rx="6" fill="#C9E2BE" />
      <rect x="318" y="0" width="32" height="110" fill="#C9E2BE" />
      <path d="M250 0 Q236 70 252 120 T238 210" fill="none" stroke="#BFE0EE" strokeWidth="18" />
      <g stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round">
        <path d="M0 52 H350M0 118 H350M0 176 H350M70 0 V210M150 0 V210M310 0 V210" />
      </g>
    </svg>
  );
}

/** 當日路線：編號圖釘依序以直線連接 */
export default function MapView({ points, mapsKey, mapId }: { points: MapPoint[]; mapsKey: string; mapId: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const overlays = useRef<any[]>([]);
  const [state, setState] = useState<'idle' | 'ready' | 'failed'>('idle');
  const signature = JSON.stringify(points);

  useEffect(() => {
    if (!mapsKey) return;
    let cancelled = false;
    (async () => {
      try {
        const maps = await loadMaps(mapsKey);
        const { Map } = await maps.importLibrary('maps');
        await maps.importLibrary('marker');
        if (cancelled || !el.current) return;
        map.current = new Map(el.current, {
          center: { lat: 25.034, lng: 121.5645 },
          zoom: 12,
          mapId: mapId || 'DEMO_MAP_ID',
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'cooperative',
        });
        setState('ready');
      } catch {
        if (!cancelled) setState('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mapsKey, mapId]);

  useEffect(() => {
    if (state !== 'ready' || !map.current) return;
    const maps = window.google.maps;
    overlays.current.forEach((o) => (o.setMap ? o.setMap(null) : (o.map = null)));
    overlays.current = [];
    const pts: MapPoint[] = JSON.parse(signature);
    if (pts.length === 0) return;

    const bounds = new maps.LatLngBounds();
    for (const p of pts) {
      const pin = document.createElement('div');
      pin.className = 'pin';
      pin.textContent = p.label;
      overlays.current.push(
        new maps.marker.AdvancedMarkerElement({ map: map.current, position: p, content: pin, title: p.title }),
      );
      bounds.extend(p);
    }
    overlays.current.push(
      new maps.Polyline({ map: map.current, path: pts, strokeColor: '#1F6F8F', strokeWeight: 3, strokeOpacity: 1 }),
    );
    if (pts.length === 1) {
      map.current.setCenter(pts[0]);
      map.current.setZoom(15);
    } else {
      map.current.fitBounds(bounds, 40);
    }
  }, [state, signature]);

  const note = !mapsKey
    ? '尚未設定 Google 地圖金鑰，目前只顯示清單；設定後這裡會出現當日路線。'
    : state === 'failed'
      ? 'Google 地圖載入失敗，可能是目前離線或金鑰設定有誤。'
      : state === 'ready' && points.length === 0
        ? '這一天的地點還沒有位置資訊。用搜尋新增地點，就會出現在地圖上。'
        : '';

  return (
    <div className="map">
      {state !== 'ready' && <Placeholder />}
      <div ref={el} style={{ position: 'absolute', inset: 0, visibility: state === 'ready' ? 'visible' : 'hidden' }} />
      {note && <div className="map-note">{note}</div>}
    </div>
  );
}
