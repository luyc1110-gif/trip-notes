import { NextResponse } from 'next/server';
import { DEV_EMAIL, OWNER_COOKIE, cookieOptions, devLoginEnabled, makeOwnerToken } from '@/lib/auth';

// 只在本機開發、且沒有設定 Google OAuth 時可用；正式環境一律回 404
export async function POST(req: Request) {
  if (!devLoginEnabled()) return new NextResponse('Not found', { status: 404 });
  const res = NextResponse.redirect(`${new URL(req.url).origin}/`, { status: 303 });
  res.cookies.set(OWNER_COOKIE, makeOwnerToken(DEV_EMAIL), cookieOptions(30));
  return res;
}
