// 資料庫連線：正式環境用 Neon（HTTP 驅動，適合 Vercel serverless）；
// 本機沒有 DATABASE_URL 時改用 PGlite，把資料存在專案的 .pglite/ 資料夾。

type Row = Record<string, unknown>;
type QueryFn = (text: string, params: unknown[]) => Promise<Row[]>;

const g = globalThis as unknown as { __tripDb?: Promise<QueryFn> };

async function connect(): Promise<QueryFn> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(url);
    return async (text, params) => (await sql.query(text, params)) as Row[];
  }
  // LOCAL_PGLITE=1 只用於在自己電腦上以正式模式（next start）測試離線功能
  if (process.env.NODE_ENV === 'production' && process.env.LOCAL_PGLITE !== '1') {
    throw new Error('正式環境必須設定 DATABASE_URL');
  }
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite(path.join(process.cwd(), '.pglite'));
  const dir = path.join(process.cwd(), 'sql');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
  }
  return async (text, params) => (await db.query(text, params)).rows as Row[];
}

export async function q<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  if (!g.__tripDb) {
    g.__tripDb = connect().catch((err) => {
      g.__tripDb = undefined;
      throw err;
    });
  }
  const run = await g.__tripDb;
  return (await run(text, params)) as T[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}
