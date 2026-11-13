import { NextResponse } from 'next/server';
import { fail, readJson } from '@/lib/http';
import { HttpError, applyOp, getSnapshot, resolveActor } from '@/lib/trip';
import type { Op } from '@/lib/types';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const actor = await resolveActor(id);
    if (!actor) throw new HttpError(401, '沒有這趟旅程的權限');
    const op = (await readJson(req)) as unknown as Op;
    await applyOp(id, actor, op);
    if (op.op === 'trip.delete') return NextResponse.json({ deleted: true });
    return NextResponse.json(await getSnapshot(id, actor), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return fail(err);
  }
}
