create extension if not exists pgcrypto;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  competition_name text not null,
  deadline timestamptz not null,
  original_url text not null default '',
  content text not null default '',
  contact text not null default '',
  created_at timestamptz not null default now()
);

alter table public.posts enable row level security;
revoke all on table public.posts from anon;
grant select on table public.posts to authenticated;
grant insert (author_id, title, competition_name, deadline, original_url, content, contact) on table public.posts to authenticated;
grant update (title, competition_name, deadline, original_url, content, contact) on table public.posts to authenticated;
grant delete on table public.posts to authenticated;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  content text not null default '',
  state text not null default '검토 중' check (state in ('검토 중', '합격', '탈락')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, post_id)
);

alter table public.applications enable row level security;
revoke all on table public.applications from anon;
grant select on table public.applications to authenticated;
grant insert (user_id, post_id, content) on table public.applications to authenticated;
grant delete on table public.applications to authenticated;

drop policy if exists "Authenticated users can view all posts" on public.posts;
create policy "Authenticated users can view all posts"
  on public.posts for select to authenticated
  using (true);

drop policy if exists "Users can insert own posts" on public.posts;
create policy "Users can insert own posts"
  on public.posts for insert to authenticated
  with check ((select auth.uid()) = author_id);

drop policy if exists "Users can update own posts" on public.posts;
create policy "Users can update own posts"
  on public.posts for update to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

drop policy if exists "Users can delete own posts" on public.posts;
create policy "Users can delete own posts"
  on public.posts for delete to authenticated
  using ((select auth.uid()) = author_id);

drop policy if exists "Users can read own applications" on public.applications;
create policy "Users can read own applications"
  on public.applications for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own applications" on public.applications;
create policy "Users can insert own applications"
  on public.applications for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own applications" on public.applications;
create policy "Users can delete own applications"
  on public.applications for delete to authenticated
  using ((select auth.uid()) = user_id);
