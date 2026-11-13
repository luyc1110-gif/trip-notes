'use client';

import { useEffect } from 'react';

/** 註冊 service worker，並把這一頁已經載入的程式與字型交給它存起來，下次離線也能開 */
export default function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        const urls = performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .filter((u) => u.includes('/_next/static/') || u.includes('fonts.googleapis.com') || u.includes('fonts.gstatic.com'));
        const page = window.location.pathname.startsWith('/t/')
          ? window.location.origin + window.location.pathname
          : null;
        reg.active?.postMessage({ type: 'precache', urls, page });
      })
      .catch(() => {
        /* 不支援或被封鎖時，App 仍可線上使用 */
      });
  }, []);
  return null;
}
