-- ArtForge database setup
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- Safe to run more than once.

-- ============================================================
-- PROFILES — one row per account, created automatically on sign-up
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)), 60)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- PIECES — an artwork someone is working on
-- ============================================================
create table if not exists public.pieces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  medium text check (char_length(medium) <= 60),
  feedback_wanted text check (char_length(feedback_wanted) <= 1000),
  status text not null default 'in_progress' check (status in ('in_progress', 'finished')),
  finish_by date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pieces_owner_idx on public.pieces (owner_id);
create index if not exists pieces_updated_idx on public.pieces (updated_at desc);

-- ============================================================
-- VERSIONS — each uploaded revision of a piece
-- ============================================================
create table if not exists public.versions (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references public.pieces (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  version_number int not null check (version_number >= 1),
  image_path text not null,
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  unique (piece_id, version_number)
);
create index if not exists versions_piece_idx on public.versions (piece_id);

-- ============================================================
-- CRITIQUES — pinned notes left on a specific version
-- ============================================================
create table if not exists public.critiques (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.versions (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  category text not null check (category in ('composition', 'values', 'anatomy', 'color', 'intent', 'other')),
  body text not null check (char_length(body) between 1 and 2000),
  pin_x real check (pin_x between 0 and 1),
  pin_y real check (pin_y between 0 and 1),
  created_at timestamptz not null default now()
);
create index if not exists critiques_version_idx on public.critiques (version_id);

-- Keep pieces.updated_at fresh when the piece, a version, or a critique changes,
-- so recently active pieces float to the top.
create or replace function public.touch_piece()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_table_name = 'pieces' then
    new.updated_at := now();
    return new;
  elsif tg_table_name = 'versions' then
    update public.pieces set updated_at = now() where id = new.piece_id;
  elsif tg_table_name = 'critiques' then
    update public.pieces set updated_at = now()
      where id = (select piece_id from public.versions where id = new.version_id);
  end if;
  return new;
end;
$$;

drop trigger if exists pieces_touch on public.pieces;
create trigger pieces_touch before update on public.pieces
  for each row execute function public.touch_piece();
drop trigger if exists versions_touch on public.versions;
create trigger versions_touch after insert on public.versions
  for each row execute function public.touch_piece();
drop trigger if exists critiques_touch on public.critiques;
create trigger critiques_touch after insert on public.critiques
  for each row execute function public.touch_piece();

-- ============================================================
-- SECURITY (row level security)
-- Signed-in artists can see every piece (that's how critique works),
-- but can only change their own pieces, versions and critiques.
-- ============================================================
alter table public.profiles  enable row level security;
alter table public.pieces    enable row level security;
alter table public.versions  enable row level security;
alter table public.critiques enable row level security;

drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles
  for select to authenticated using (true);
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "pieces readable" on public.pieces;
create policy "pieces readable" on public.pieces
  for select to authenticated using (true);
drop policy if exists "create own pieces" on public.pieces;
create policy "create own pieces" on public.pieces
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists "update own pieces" on public.pieces;
create policy "update own pieces" on public.pieces
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "delete own pieces" on public.pieces;
create policy "delete own pieces" on public.pieces
  for delete to authenticated using (owner_id = auth.uid());

drop policy if exists "versions readable" on public.versions;
create policy "versions readable" on public.versions
  for select to authenticated using (true);
drop policy if exists "add versions to own pieces" on public.versions;
create policy "add versions to own pieces" on public.versions
  for insert to authenticated with check (
    owner_id = auth.uid()
    and exists (select 1 from public.pieces p where p.id = piece_id and p.owner_id = auth.uid())
  );
drop policy if exists "delete own versions" on public.versions;
create policy "delete own versions" on public.versions
  for delete to authenticated using (owner_id = auth.uid());

drop policy if exists "critiques readable" on public.critiques;
create policy "critiques readable" on public.critiques
  for select to authenticated using (true);
drop policy if exists "write own critiques" on public.critiques;
create policy "write own critiques" on public.critiques
  for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "delete own critiques" on public.critiques;
create policy "delete own critiques" on public.critiques
  for delete to authenticated using (author_id = auth.uid());

-- ============================================================
-- IMAGE STORAGE — private bucket; files live under <user id>/...
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('artwork', 'artwork', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "artwork readable" on storage.objects;
create policy "artwork readable" on storage.objects
  for select to authenticated using (bucket_id = 'artwork');
drop policy if exists "upload own artwork" on storage.objects;
create policy "upload own artwork" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'artwork' and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "delete own artwork" on storage.objects;
create policy "delete own artwork" on storage.objects
  for delete to authenticated using (
    bucket_id = 'artwork' and (storage.foldername(name))[1] = auth.uid()::text
  );
