-- Gemiverse shared base. Only entities live here: no column records who asked for or kept anything.
create table if not exists entities (
  id text primary key,
  type text not null,                 -- from the locked ontology (event, place, org, ...)
  school text not null,               -- 'NYU' | 'Columbia'
  name text not null,
  fields jsonb not null default '{}', -- filled to the locked ontology
  tier int not null default 4,        -- source tier, 1 = best
  ontology_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists links (
  id bigint generated always as identity primary key,
  from_id text not null references entities(id) on delete cascade,
  to_id text not null references entities(id) on delete cascade,
  rel text not null,
  confidence real,
  unique (from_id, to_id, rel)
);
create table if not exists evidence (
  id bigint generated always as identity primary key,
  entity_id text not null references entities(id) on delete cascade,
  field text not null,
  quote text,
  url text,
  check_confidence real,              -- from the Decisions API
  passed boolean,
  content_hash text,                  -- for revisits: only changed pages are re-checked
  checked_at timestamptz not null default now()
);
create index if not exists entities_school_type on entities (school, type);
create index if not exists evidence_entity on evidence (entity_id);
alter table entities enable row level security;
alter table links enable row level security;
alter table evidence enable row level security;
create policy "public read entities" on entities for select using (true);
create policy "public read links" on links for select using (true);
create policy "public read evidence" on evidence for select using (true);
