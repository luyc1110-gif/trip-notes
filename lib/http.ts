import { NextResponse } from 'next/server';
import { HttpError } from './trip';

export function fail(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return NextResponse.json({ error: '伺服器發生錯誤，請稍後再試' }, { status: 500 });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === 'object') return body as Record<string, unknown>;
  } catch {
    /* 落到下面 */
  }
  throw new HttpError(400, '請求格式不正確');
}
