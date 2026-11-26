create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  event_name text not null check (length(trim(event_name)) > 0),
  deadline date not null,
  source_url text not null check (source_url ~* '^https?://'),
  title text not null check (length(trim(title)) > 0),
  recruiting_content text not null check (length(trim(recruiting_content)) > 0),
  recruitment_count integer not null check (recruitment_count > 0),
  contact_email text not null check (contact_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists boards_created_at_idx on public.boards (created_at desc);
create index if not exists boards_owner_created_at_idx on public.boards (owner_id, created_at desc);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  applicant_id uuid not null references auth.users (id) on delete cascade,
  content text not null check (length(trim(content)) > 0),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, applicant_id)
);

create index if not exists applications_applicant_created_at_idx on public.applications (applicant_id, created_at desc);
create index if not exists applications_board_created_at_idx on public.applications (board_id, created_at desc);

-- 게시글과 지원 내역은 Express API를 통해서만 조회합니다.
-- service-role 키는 서버에만 보관하고, 개인 정보 조회는 인증된 사용자 ID로 제한합니다.
alter table public.boards enable row level security;
alter table public.applications enable row level security;
revoke all on table public.boards, public.applications from anon, authenticated;
grant all on table public.boards, public.applications to service_role;
