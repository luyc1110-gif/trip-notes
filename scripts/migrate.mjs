// 把 sql/ 資料夾裡的檔案依檔名順序套用到 Neon。
// 用法：DATABASE_URL="postgres://..." npm run db:migrate
// 每個檔案都寫成可以重複執行（create table if not exists），所以重跑是安全的。
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('請先設定 DATABASE_URL（Neon 專案的連線字串）');
  process.exit(1);
}

const sql = neon(url);
const dir = path.join(import.meta.dirname, '..', 'sql');

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  // Neon 的 HTTP 驅動一次只能送一個敘述，所以先去掉註解再用分號切開
  const statements = fs
    .readFileSync(path.join(dir, file), 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) await sql.query(statement);
  console.log(`✔ ${file}（${statements.length} 個敘述）`);
}
console.log('資料表已就緒');
