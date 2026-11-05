// Creates the tables. Safe to run more than once.
// Usage: node --env-file=.env.local scripts/migrate.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`
  create table if not exists items (
    id serial primary key,
    title_en text not null,
    description_en text not null default '',
    price_cents integer,
    images text[] not null default '{}',
    status text not null default 'available'
      check (status in ('available', 'reserved', 'sold')),
    visible boolean not null default true,
    position integer not null default 0,
    created_at timestamptz not null default now()
  )`;

// Items are bilingual: the public page shows Portuguese first, then English.
await sql`
  do $$ begin
    if exists (select 1 from information_schema.columns where table_name = 'items' and column_name = 'title') then
      alter table items rename column title to title_en;
      alter table items rename column description to description_en;
    end if;
  end $$`;
await sql`alter table items add column if not exists title_pt text not null default ''`;
await sql`alter table items add column if not exists description_pt text not null default ''`;
await sql`alter table items add column if not exists category text not null default 'house'`;
// Items still in use: shown in a "later" section and can be reserved now. NULL = available now.
await sql`alter table items add column if not exists available_from date`;

await sql`
  create table if not exists interests (
    id serial primary key,
    item_id integer not null references items(id) on delete cascade,
    name text not null,
    contact text not null default '',
    message text not null,
    handled boolean not null default false,
    created_at timestamptz not null default now()
  )`;

await sql`create index if not exists interests_created_idx on interests (created_at desc)`;

// Chat bot settings edited from the admin page (WhatsApp number, instructions).
await sql`create table if not exists settings (key text primary key, value text not null default '')`;

// Per-visitor daily cap on chat requests, to keep API costs bounded.
await sql`
  create table if not exists chat_usage (
    ip text not null,
    day date not null default current_date,
    count integer not null default 0,
    primary key (ip, day)
  )`;



// Pickup schedule in the admin: who comes for what, when, and who's talking to them.
await sql`
  create table if not exists pickups (
    id serial primary key,
    day date not null,
    time text not null default '',
    name text not null default '',
    item text not null default '',
    channel text not null default '',
    handler text not null default '',
    done boolean not null default false,
    created_at timestamptz not null default now()
  )`;

// Tracking: named ref links (?ref=slug) and anonymous visit/event log for the admin dashboard.
await sql`
  create table if not exists refs (
    slug text primary key,
    label text not null,
    created_at timestamptz not null default now()
  )`;
await sql`insert into refs (slug, label) values ('fb', 'Facebook Marketplace') on conflict do nothing`;
await sql`
  create table if not exists events (
    id bigserial primary key,
    at timestamptz not null default now(),
    type text not null,
    visitor text not null,
    session text not null,
    ref text,
    item_ids integer[] not null default '{}'
  )`;
await sql`create index if not exists events_at_idx on events (at)`;
// Lead details for the admin's "message on WhatsApp" button.
await sql`alter table interests add column if not exists language text not null default 'en'`;
await sql`alter table interests add column if not exists pickup_when text not null default ''`;
await sql`alter table interests add column if not exists offer text not null default ''`;
await sql`alter table interests add column if not exists app text not null default ''`;

// Chat transcripts, one row per conversation, for the admin.
await sql`
  create table if not exists chats (
    id uuid primary key,
    started_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    visitor text not null default '',
    ref text,
    item_ids integer[] not null default '{}',
    messages jsonb not null default '[]',
    lead boolean not null default false
  )`;
await sql`create index if not exists chats_started_idx on chats (started_at desc)`;
await sql`alter table interests add column if not exists chat_id uuid`;

console.log("migrated");
