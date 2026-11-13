import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const isProd = process.env.NODE_ENV === 'production';

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (!isProd) return 'dev-only-secret-do-not-use-in-production';
  throw new Error('正式環境必須設定至少 32 個字元的 SESSION_SECRET');
}

function sign(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function cookieOptions(days: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd,
    path: '/',
    maxAge: days * 24 * 60 * 60,
  };
}

// ── 建立者（Google 登入） ───────────────────────────────

export const OWNER_COOKIE = 'th_owner';
export const OAUTH_STATE_COOKIE = 'th_oauth_state';
export const DEV_EMAIL = 'dev@localhost';

/** 本機沒設定 Google OAuth 時，提供開發用的免密碼登入；正式環境永遠關閉 */
export function devLoginEnabled(): boolean {
  return !isProd && !process.env.GOOGLE_CLIENT_ID;
}

export function isAllowedOwner(email: string): boolean {
  const list = (process.env.OWNER_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const e = email.toLowerCase();
  if (list.includes(e)) return true;
  return devLoginEnabled() && e === DEV_EMAIL;
}

export function makeOwnerToken(email: string): string {
  const body = Buffer.from(
    JSON.stringify({ email, exp: Date.now() + 180 * 24 * 60 * 60 * 1000 }),
  ).toString('base64url');
  return `${body}.${sign('owner.' + body)}`;
}

export function readOwnerToken(token: string | undefined): string | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig || !safeEqual(sig, sign('owner.' + body))) return null;
  try {
    const { email, exp } = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof email !== 'string' || typeof exp !== 'number' || exp < Date.now()) return null;
    // 白名單若之後被改掉，舊的登入也要失效
    return isAllowedOwner(email) ? email : null;
  } catch {
    return null;
  }
}

export async function getOwnerEmail(): Promise<string | null> {
  const store = await cookies();
  return readOwnerToken(store.get(OWNER_COOKIE)?.value);
}

// ── 同行者（邀請連結認領） ───────────────────────────────

export function newInviteToken(): string {
  return randomBytes(18).toString('base64url');
}

export function guestCookieName(tripId: string): string {
  return 'th_g_' + tripId.replace(/-/g, '');
}

/** cookie 綁定當下的邀請 token：建立者重置連結後，舊 cookie 自動失效 */
export function makeGuestToken(tripId: string, memberId: string, inviteToken: string): string {
  return `${memberId}.${sign(`guest.${tripId}.${memberId}.${inviteToken}`)}`;
}

export function readGuestToken(
  token: string | undefined,
  tripId: string,
  inviteToken: string,
): string | null {
  if (!token) return null;
  const [memberId, sig] = token.split('.');
  if (!memberId || !sig) return null;
  return safeEqual(sig, sign(`guest.${tripId}.${memberId}.${inviteToken}`)) ? memberId : null;
}
