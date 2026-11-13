import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getOwnerEmail, guestCookieName, readGuestToken } from '@/lib/auth';
import { q } from '@/lib/db';
import JoinClient from '@/components/JoinClient';

export const dynamic = 'force-dynamic';

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [trip] = await q<{ id: string; name: string; start_date: string; end_date: string; cover: string }>(
    `select id, name, to_char(start_date, 'YYYY-MM-DD') as start_date,
            to_char(end_date, 'YYYY-MM-DD') as end_date, cover
     from trips where invite_token = $1 and deleted_at is null`,
    [token],
  );

  if (!trip) {
    return (
      <main className="app">
        <div className="body" style={{ justifyContent: 'center' }}>
          <h1 className="h1">這個邀請連結已經失效</h1>
          <p className="notice">旅程建立者可能重置了連結。請向對方索取最新的邀請連結。</p>
        </div>
      </main>
    );
  }

  // 建立者本人，或這支手機已經認領過，就直接進旅程
  if (await getOwnerEmail()) redirect(`/t/${trip.id}`);
  const store = await cookies();
  if (readGuestToken(store.get(guestCookieName(trip.id))?.value, trip.id, token)) redirect(`/t/${trip.id}`);

  const members = await q<{ id: string; name: string; color: number; is_owner: boolean; claimed: boolean }>(
    `select id, name, color, is_owner, (claimed_at is not null or is_owner) as claimed
     from members where trip_id = $1 and deleted_at is null order by sort, created_at`,
    [trip.id],
  );

  return (
    <JoinClient
      token={token}
      trip={{ name: trip.name, startDate: trip.start_date, endDate: trip.end_date, cover: trip.cover }}
      ownerName={members.find((m) => m.is_owner)?.name ?? '旅程建立者'}
      members={members.map((m) => ({ id: m.id, name: m.name, color: Number(m.color), claimed: Boolean(m.claimed) }))}
    />
  );
}
