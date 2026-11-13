'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Expense, Op, Snapshot } from '@/lib/types';

type Status = 'loading' | 'ready' | 'denied' | 'error';
export type SaveResult = 'saved' | 'queued' | 'failed';
type QueuedExpense = Omit<Expense, 'createdBy' | 'pending'>;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 私密瀏覽或空間不足時略過，不影響線上使用 */
  }
}

/**
 * 旅程資料的用戶端來源：
 * - 先顯示上次存在手機裡的資料，再向伺服器取最新版；回到前景與每 45 秒會再更新。
 * - 離線時新增的花費先排進佇列，連線後自動補傳（每筆有固定 id，重送不會重複）。
 */
export function useTrip(tripId: string) {
  const cacheKey = `th:snap:${tripId}`;
  const queueKey = `th:queue:${tripId}`;
  const [snap, setSnapState] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [online, setOnline] = useState(true);
  const [queue, setQueueState] = useState<QueuedExpense[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const snapRef = useRef<Snapshot | null>(null);
  const flushing = useRef(false);

  const setSnap = useCallback(
    (next: Snapshot) => {
      snapRef.current = next;
      setSnapState(next);
      setStatus('ready');
      writeJson(cacheKey, next);
      // 同行者把 App 加到主畫面後，從首頁開啟時要能直接回到這趟旅程
      if (next.me.role === 'guest') writeJson('th:lastTrip', tripId);
    },
    [cacheKey, tripId],
  );

  const setQueue = useCallback(
    (next: QueuedExpense[]) => {
      setQueueState(next);
      writeJson(queueKey, next);
    },
    [queueKey],
  );

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((cur) => (cur === message ? null : cur)), 4000);
  }, []);

  const post = useCallback(
    async (op: Op): Promise<{ ok: true; snap: Snapshot | null } | { ok: false; error: string; offline: boolean }> => {
      let res: Response;
      try {
        res = await fetch(`/api/trips/${tripId}/act`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(op),
        });
      } catch {
        return { ok: false, error: '目前離線', offline: true };
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error ?? '操作失敗', offline: false };
      return { ok: true, snap: data.deleted ? null : (data as Snapshot) };
    },
    [tripId],
  );

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      let rest = readJson<QueuedExpense[]>(queueKey, []);
      while (rest.length > 0) {
        const result = await post({ op: 'expense.upsert', expense: rest[0] });
        if (!result.ok && result.offline) {
          setOnline(false);
          break;
        }
        if (result.ok && result.snap) setSnap(result.snap);
        if (!result.ok) notify(`「${rest[0].description}」無法上傳：${result.error}`);
        rest = rest.slice(1);
        setQueue(rest);
      }
    } finally {
      flushing.current = false;
    }
  }, [post, queueKey, setQueue, setSnap, notify]);

  const refresh = useCallback(async () => {
    let res: Response;
    try {
      res = await fetch(`/api/trips/${tripId}`, { cache: 'no-store' });
    } catch {
      setOnline(false);
      if (!snapRef.current) setStatus('error');
      return;
    }
    setOnline(true);
    if (res.status === 401 || res.status === 404) {
      setStatus('denied');
      // 權限失效後不要再把首頁自動導回這趟旅程，也不留舊資料
      try {
        if (readJson<string | null>('th:lastTrip', null) === tripId) localStorage.removeItem('th:lastTrip');
        localStorage.removeItem(cacheKey);
      } catch {
        /* 略過 */
      }
      return;
    }
    if (!res.ok) {
      if (!snapRef.current) setStatus('error');
      return;
    }
    setSnap((await res.json()) as Snapshot);
  }, [tripId, setSnap]);

  useEffect(() => {
    const cached = readJson<Snapshot | null>(cacheKey, null);
    if (cached) {
      snapRef.current = cached;
      setSnapState(cached);
      setStatus('ready');
    }
    setQueueState(readJson<QueuedExpense[]>(queueKey, []));

    const sync = () => {
      if (document.visibilityState !== 'visible') return;
      void refresh().then(flush);
    };
    sync();
    const timer = window.setInterval(sync, 45000);
    const goOffline = () => setOnline(false);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('online', sync);
    window.addEventListener('offline', goOffline);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', goOffline);
    };
  }, [cacheKey, queueKey, refresh, flush]);

  /** 一般操作：需要連線；成功後整份資料換成伺服器回傳的最新版 */
  const act = useCallback(
    async (op: Op): Promise<boolean> => {
      setBusy(true);
      try {
        const result = await post(op);
        if (!result.ok) {
          if (result.offline) setOnline(false);
          notify(result.offline ? '目前離線，這個操作需要連上網路' : result.error);
          return false;
        }
        setOnline(true);
        if (result.snap) setSnap(result.snap);
        return true;
      } finally {
        setBusy(false);
      }
    },
    [post, notify, setSnap],
  );

  /** 新增或修改花費：離線時新增的會先排隊 */
  const saveExpense = useCallback(
    async (expense: QueuedExpense, isNew: boolean): Promise<SaveResult> => {
      setBusy(true);
      try {
        const result = await post({ op: 'expense.upsert', expense });
        if (result.ok) {
          setOnline(true);
          if (result.snap) setSnap(result.snap);
          return 'saved';
        }
        if (result.offline) {
          setOnline(false);
          if (isNew) {
            setQueue([...readJson<QueuedExpense[]>(queueKey, []), expense]);
            return 'queued';
          }
          notify('目前離線，修改既有的花費需要連上網路');
          return 'failed';
        }
        notify(result.error);
        return 'failed';
      } finally {
        setBusy(false);
      }
    },
    [post, notify, setSnap, setQueue, queueKey],
  );

  return { snap, status, online, queue, busy, toast, act, saveExpense, refresh, notify };
}

export type TripStore = ReturnType<typeof useTrip>;
