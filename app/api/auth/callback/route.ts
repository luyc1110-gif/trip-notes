import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  OAUTH_STATE_COOKIE,
  OWNER_COOKIE,
  cookieOptions,
  isAllowedOwner,
  makeOwnerToken,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const back = (error: string) => {
    const res = NextResponse.redirect(`${origin}/?error=${error}`);
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  };

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = (await cookies()).get(OAUTH_STATE_COOKIE)?.value;
  if (!code || !state || !expected || state !== expected) return back('login_failed');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return back('not_configured');

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${origin}/api/auth/callback`,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) return back('login_failed');
    const { access_token: accessToken } = (await tokenRes.json()) as { access_token?: string };
    if (!accessToken) return back('login_failed');

    const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!infoRes.ok) return back('login_failed');
    const info = (await infoRes.json()) as { email?: string; email_verified?: boolean };
    if (!info.email || !info.email_verified || !isAllowedOwner(info.email)) {
      return back('not_allowed');
    }

    const res = NextResponse.redirect(`${origin}/`);
    res.cookies.set(OWNER_COOKIE, makeOwnerToken(info.email), cookieOptions(180));
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  } catch (err) {
    console.error(err);
    return back('login_failed');
  }
}
