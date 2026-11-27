-- Extends existing boards/applications; no replacement of auth/profile/read models.
-- Only the Express service-role client can execute these functions. p_owner_id
-- MUST come from requireAuth's verified authUser.id, never a request payload.
-- Internal transactional outbox. Only the worker's service-role key can access it.
create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  recipient text not null,
  event_name text not null,
  status text not null check (status in ('accepted', 'rejected')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  lock_token uuid,
  last_error text
);
create index email_outbox_pending_idx on public.email_outbox(next_attempt_at) where sent_at is null;

alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;
grant all on public.email_outbox to service_role;

-- All decisions and capacity changes lock the same board row first.
create function public.update_host_board(p_owner_id uuid, p_board_id uuid, p_patch jsonb)
returns public.boards language plpgsql security definer set search_path = '' as $$
declare b public.boards; accepted_count integer;
begin
  if p_owner_id is null then raise insufficient_privilege; end if;
  select * into b from public.boards where id = p_board_id and owner_id = p_owner_id for update;
  if not found then raise no_data_found; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then
    raise exception using errcode = '22023', message = 'Invalid patch';
  end if;
  if exists (select 1 from jsonb_object_keys(p_patch) as k where k not in ('event_name','source_url','deadline','title','recruiting_content','recruitment_count','contact_email')) then
    raise exception using errcode = '22023', message = 'Unknown field';
  end if;
  if exists (select 1 from jsonb_each(p_patch) e where
    (e.key = 'recruitment_count' and (jsonb_typeof(e.value) <> 'number' or e.value::text !~ '^[1-9][0-9]*$')) or
    (e.key <> 'recruitment_count' and jsonb_typeof(e.value) <> 'string')) then
    raise exception using errcode = '22023', message = 'Invalid field type';
  end if;
  select count(*) into accepted_count from public.applications where board_id = b.id and status = 'accepted';
  if p_patch ? 'recruitment_count' and (p_patch->>'recruitment_count')::numeric < accepted_count then
    raise check_violation using message = 'Cannot reduce capacity below accepted count';
  end if;
  update public.boards set
    event_name = case when p_patch ? 'event_name' then p_patch->>'event_name' else b.event_name end,
    source_url = case when p_patch ? 'source_url' then p_patch->>'source_url' else b.source_url end,
    deadline = case when p_patch ? 'deadline' then (p_patch->>'deadline')::date else b.deadline end,
    title = case when p_patch ? 'title' then p_patch->>'title' else b.title end,
    recruiting_content = case when p_patch ? 'recruiting_content' then p_patch->>'recruiting_content' else b.recruiting_content end,
    recruitment_count = case when p_patch ? 'recruitment_count' then (p_patch->>'recruitment_count')::integer else b.recruitment_count end,
    contact_email = case when p_patch ? 'contact_email' then p_patch->>'contact_email' else b.contact_email end,
    updated_at = clock_timestamp()
  where id = b.id returning * into b;
  return b;
end;
$$;

create function public.decide_host_application(p_owner_id uuid, p_application_id uuid, p_status text)
returns public.applications language plpgsql security definer set search_path = '' as $$
declare a public.applications; b public.boards; board_uuid uuid; recipient_email text;
begin
  if p_owner_id is null then raise insufficient_privilege; end if;
  if p_status is null or p_status not in ('accepted', 'rejected') then
    raise exception using errcode = '22023', message = 'Invalid decision';
  end if;
  select board_id into board_uuid from public.applications where id = p_application_id;
  select * into b from public.boards where id = board_uuid and owner_id = p_owner_id for update;
  if not found then raise no_data_found; end if;
  select * into a from public.applications where id = p_application_id for update;
  if not found then raise no_data_found; end if;
  if a.applicant_id = p_owner_id then raise check_violation using message = 'Cannot decide own application'; end if;
  -- Same decision is idempotent; a final decision cannot be reversed.
  if a.status = p_status then return a; end if;
  if a.status <> 'pending' then raise check_violation using message = 'Decision is final'; end if;
  if p_status = 'accepted' and (select count(*) from public.applications where board_id = b.id and status = 'accepted') >= b.recruitment_count then
    raise check_violation using message = 'Recruitment capacity reached';
  end if;
  select email into recipient_email from auth.users where id = a.applicant_id;
  if recipient_email is null then raise check_violation using message = 'Applicant has no email'; end if;
  update public.applications set status = p_status, updated_at = clock_timestamp() where id = a.id returning * into a;
  insert into public.email_outbox(application_id, recipient, event_name, status)
    values(a.id, recipient_email, b.event_name, p_status);
  return a;
end;
$$;

create function public.claim_host_emails()
returns setof public.email_outbox language sql security definer set search_path = '' as $$
  update public.email_outbox set locked_at = clock_timestamp(), lock_token = gen_random_uuid(), attempts = attempts + 1
  where id in (
    select id from public.email_outbox where sent_at is null and next_attempt_at <= now()
      and (locked_at is null or locked_at < now() - interval '10 minutes')
    order by created_at for update skip locked limit 10
  ) returning *;
$$;

revoke all on function public.update_host_board(uuid,uuid,jsonb), public.decide_host_application(uuid,uuid,text), public.claim_host_emails() from public, anon, authenticated;
grant execute on function public.update_host_board(uuid,uuid,jsonb), public.decide_host_application(uuid,uuid,text) to service_role;
grant execute on function public.claim_host_emails() to service_role;
