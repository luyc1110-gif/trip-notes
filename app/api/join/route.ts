import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { cookieOptions, guestCookieName, makeGuestToken, readGuestToken } from '@/lib/auth';
import { isUuid, q } from '@/lib/db';
import { fail, readJson } from '@/lib/http';
import { HttpError } from '@/lib/trip';

export async function POST(req: Request) {
  try {
    const { token, memberId } = await readJson(req);
    if (typeof token !== 'string' || !isUuid(memberId)) throw new HttpError(400, '請求格式不正確');

    const [trip] = await q<{ id: string }>(
      'select id from trips where invite_token = $1 and deleted_at is null',
      [token],
    );
    if (!trip) throw new HttpError(404, '這個邀請連結已經失效，請向旅程建立者索取新的連結');

    // 只有「還沒被認領」的名字能認領；用單一 UPDATE 確保兩支手機同時按也只有一支成功
    const claimed = await q<{ id: string }>(
      `update members set claimed_at = now()
       where id = $1 and trip_id = $2 and deleted_at is null and not is_owner and claimed_at is null
       returning id`,
      [memberId, trip.id],
    );
    if (claimed.length === 0) {
      const store = await cookies();
      const mine = readGuestToken(store.get(guestCookieName(trip.id))?.value, trip.id, token);
      if (mine !== memberId) throw new HttpError(409, '這個名字已經被認領了，請選自己的名字');
    }

    const res = NextResponse.json({ tripId: trip.id });
    res.cookies.set(guestCookieName(trip.id), makeGuestToken(trip.id, memberId, token), cookieOptions(400));
    return res;
  } catch (err) {
    return fail(err);
  }
}
