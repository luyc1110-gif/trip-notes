-- 旅途手札：初始資料表
-- 正式環境：貼到 Neon 的 SQL Editor 執行一次，或執行 npm run db:migrate
-- 本機開發：沒有 DATABASE_URL 時會自動套用到 .pglite/

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  settle_currency text not null default 'TWD',
  cover text not null default 'town',
  invite_token text not null unique,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id),
  name text not null,
  color int not null default 0,
  is_owner boolean not null default false,
  claimed_at timestamptz,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists members_trip_idx on members (trip_id);

-- 每趟旅程每種外幣一個匯率：1 單位外幣 = rate 單位結算幣
create table if not exists trip_currencies (
  trip_id uuid not null references trips(id),
  code text not null,
  rate numeric(18, 8) not null check (rate > 0),
  primary key (trip_id, code)
);

-- id 由用戶端產生，離線補傳時重送同一筆不會重複記帳
create table if not exists expenses (
  id uuid primary key,
  trip_id uuid not null references trips(id),
  description text not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null,
  payer_id uuid not null references members(id),
  participant_ids uuid[] not null,
  category text not null default 'other',
  spent_on date not null,
  is_personal boolean not null default false,
  created_by uuid references members(id),
  updated_by uuid references members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists expenses_trip_idx on expenses (trip_id);

-- 結算時「標記已付」的轉帳，金額為結算幣的最小單位
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id),
  from_id uuid not null references members(id),
  to_id uuid not null references members(id),
  amount_minor bigint not null check (amount_minor > 0),
  created_by uuid references members(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists payments_trip_idx on payments (trip_id);

create table if not exists itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id),
  day date not null,
  sort int not null default 0,
  time text,
  name text not null,
  category text not null default 'sight',
  note text not null default '',
  place_id text,
  lat double precision,
  lng double precision,
  created_by uuid references members(id),
  updated_by uuid references members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists itinerary_trip_idx on itinerary_items (trip_id, day);

create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id),
  member_id uuid not null references members(id),
  text text not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists todos_member_idx on todos (trip_id, member_id);
