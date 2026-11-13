import { devLoginEnabled, getOwnerEmail } from '@/lib/auth';
import { APP_NAME } from '@/lib/app';
import { listTrips } from '@/lib/trip';
import HomeClient, { GuestRedirect } from '@/components/HomeClient';
import { Scene } from '@/components/Scenes';

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  not_allowed: '這個 Google 帳號不在允許建立旅程的名單內。',
  login_failed: '登入沒有完成，請再試一次。',
  not_configured: '這個站台還沒有設定 Google 登入。',
};

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const email = await getOwnerEmail();
  if (email) return <HomeClient trips={await listTrips()} email={email} />;

  const { error } = await searchParams;
  return (
    <main className="app">
      <GuestRedirect />
      <header className="hero tall">
        <Scene kind="town" crop="tall" />
        <div className="hero-text" style={{ top: 64, gap: 10 }}>
          <h1 style={{ fontSize: 40 }}>{APP_NAME}</h1>
          <div style={{ fontSize: 18, lineHeight: 1.5, color: 'var(--ink2)' }}>行程和分帳，一趟旅程一個連結。</div>
        </div>
      </header>
      <div className="body" style={{ gap: 16, padding: '28px 24px' }}>
        {error && ERRORS[error] && <p className="notice neg" role="alert">{ERRORS[error]}</p>}
        {devLoginEnabled() ? (
          <form method="post" action="/api/auth/dev">
            <button className="btn blue block" style={{ minHeight: 56, borderRadius: 18, fontSize: 18 }} type="submit">
              開發模式登入
            </button>
          </form>
        ) : (
          <a className="btn blue block" style={{ minHeight: 56, borderRadius: 18, fontSize: 18 }} href="/api/auth/google">
            使用 Google 帳號登入
          </a>
        )}
        <p className="sm muted center" style={{ lineHeight: 1.6 }}>
          只有建立旅程的人需要登入。
          <br />
          同行者請直接打開收到的邀請連結。
        </p>
      </div>
    </main>
  );
}
