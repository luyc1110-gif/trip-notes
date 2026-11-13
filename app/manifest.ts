import type { MetadataRoute } from 'next';
import { APP_NAME } from '@/lib/app';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: '行程和分帳，一趟旅程一個連結。',
    lang: 'zh-Hant',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#F7FAF6',
    theme_color: '#CDEAF7',
    icons: [
      { src: '/pwa-icon/192', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
