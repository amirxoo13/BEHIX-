-- Better Auth rate-limit storage (T10). Used when DATABASE_URL is set so the
-- limit is shared across serverless instances instead of per-instance memory.
-- Columns match Better Auth's `rateLimit` model (key, count, lastRequest bigint).
create table if not exists "rateLimit" (
  "id" text not null primary key,
  "key" text not null unique,
  "count" integer not null,
  "lastRequest" bigint not null
);
