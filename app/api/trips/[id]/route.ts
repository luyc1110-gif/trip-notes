import { NextResponse } from 'next/server';
import { fail } from '@/lib/http';
import { HttpError, getSnapshot, resolveActor } from '@/lib/trip';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const actor = await resolveActor(id);
    if (!actor) throw new HttpError(401, '沒有這趟旅程的權限');
    return NextResponse.json(await getSnapshot(id, actor), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return fail(err);
  }
}
