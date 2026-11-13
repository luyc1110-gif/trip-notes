import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import SwRegister from '@/components/SwRegister';
import { APP_NAME } from '@/lib/app';

export const metadata: Metadata = {
  title: APP_NAME,
  description: '行程和分帳，一趟旅程一個連結。',
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: 'default' },
  icons: { icon: '/pwa-icon/192', apple: '/pwa-icon/180' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#CDEAF7',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800&display=swap" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Huninn&display=swap" />
      </head>
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
