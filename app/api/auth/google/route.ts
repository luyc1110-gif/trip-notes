import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { OAUTH_STATE_COOKIE, cookieOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const origin = new URL(req.url).origin;
  if (!clientId) return NextResponse.redirect(`${origin}/?error=not_configured`);

  const state = randomBytes(16).toString('hex');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', `${origin}/api/auth/callback`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email');
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'select_account');

  const res = NextResponse.redirect(url.toString());
  res.cookies.set(OAUTH_STATE_COOKIE, state, { ...cookieOptions(1), maxAge: 600 });
  return res;
}
