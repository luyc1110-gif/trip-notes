import { NextResponse } from 'next/server';
import { OWNER_COOKIE } from '@/lib/auth';

export async function POST(req: Request) {
  const res = NextResponse.redirect(`${new URL(req.url).origin}/`, { status: 303 });
  res.cookies.delete(OWNER_COOKIE);
  return res;
}
