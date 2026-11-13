import { NextResponse } from 'next/server';
import { getOwnerEmail } from '@/lib/auth';
import { fail, readJson } from '@/lib/http';
import { HttpError, createTrip } from '@/lib/trip';

export async function POST(req: Request) {
  try {
    if (!(await getOwnerEmail())) throw new HttpError(401, '請先登入');
    const body = await readJson(req);
    const id = await createTrip({
      name: body.name,
      startDate: body.startDate,
      endDate: body.endDate,
      settleCurrency: body.settleCurrency,
      cover: body.cover,
      memberNames: body.memberNames,
    });
    return NextResponse.json({ id });
  } catch (err) {
    return fail(err);
  }
}
