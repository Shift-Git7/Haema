import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const host='10000000-0000-4000-8000-000000000001';
const other='10000000-0000-4000-8000-000000000002';
const applicant='10000000-0000-4000-8000-000000000003';
let board,application;
async function service(sql,args=[]) {await db.exec('set role service_role');try{return await db.query(sql,args);}finally{await db.exec('reset role');}}
const decide=(owner,id,status)=>service('select public.decide_host_application($1,$2,$3)',[owner,id,status]);
const update=(owner,patch)=>service('select public.update_host_board($1,$2,$3)',[owner,board,patch]);
before(async()=>{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to authenticated,anon,service_role;`);
  for(const name of ['202611240001_create_profiles.sql','202611260001_create_boards_and_applications.sql','202611270001_host_management.sql']) await db.exec(await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8'));
  await db.query('insert into auth.users(id,email) values ($1,$2),($3,$4),($5,$6)',[host,'host@dsm.hs.kr',other,'other@dsm.hs.kr',applicant,'applicant@dsm.hs.kr']);
  board=(await service(`insert into public.boards(owner_id,event_name,deadline,source_url,title,recruiting_content,recruitment_count,contact_email)
    values ($1,'해커톤','2026-12-20','https://example.com','모집','팀원 모집',1,'host@example.com') returning id`,[host])).rows[0].id;
  application=(await service("insert into public.applications(board_id,applicant_id,content) values ($1,$2,'지원') returning id",[board,applicant])).rows[0].id;
});
after(()=>db.close());
test('all existing migrations apply together; profile creation trigger remains functional',async()=>{
  assert.equal((await db.query('select count(*)::int as n from public.profiles')).rows[0].n,3);
});
test('anon/authenticated cannot call service-only RPCs or access tables directly',async()=>{
  for(const role of ['anon','authenticated']) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(db.query('select public.decide_host_application($1,$2,$3)',[host,application,'accepted']),{code:'42501'});
      await assert.rejects(db.query('select public.update_host_board($1,$2,$3)',[host,board,{title:'hacked'}]),{code:'42501'});
      await assert.rejects(db.query('select * from public.email_outbox'),{code:'42501'});
    }finally{await db.exec('reset role');}
  }
});
test('RPC ownership and input checks reject foreign owners and malformed patches',async()=>{
  await assert.rejects(decide(other,application,'accepted'),{code:'P0002'});
  await assert.rejects(update(other,{title:'hacked'}),{code:'P0002'});
  for(const patch of [{},{owner_id:other},{title:null},{recruitment_count:1.1}]) await assert.rejects(update(host,patch),{code:'22023'});
  await update(host,{title:'수정',deadline:'2026-12-25'});
  assert.equal((await service('select title from public.boards where id=$1',[board])).rows[0].title,'수정');
});
test('decision and notification commit together; repeated decision is idempotent and final',async()=>{
  await decide(host,application,'accepted');await decide(host,application,'accepted');
  assert.equal((await service('select status from public.applications where id=$1',[application])).rows[0].status,'accepted');
  assert.equal((await service('select * from public.email_outbox')).rows.length,1);
  await assert.rejects(decide(host,application,'rejected'),{code:'23514'});
});
test('capacity prevents additional acceptance and shrinking below accepted count; rejection still works',async()=>{
  const a2=(await service("insert into public.applications(board_id,applicant_id,content) values ($1,$2,'지원') returning id",[board,other])).rows[0].id;
  await assert.rejects(decide(host,a2,'accepted'),{code:'23514'});
  await decide(host,a2,'rejected');
  // A third applicant is accepted after growing capacity.
  const third='10000000-0000-4000-8000-000000000004';
  await db.query("insert into auth.users(id,email) values ($1,'third@dsm.hs.kr')",[third]);
  const a3=(await service("insert into public.applications(board_id,applicant_id,content) values ($1,$2,'지원') returning id",[board,third])).rows[0].id;
  await update(host,{recruitment_count:2});await decide(host,a3,'accepted');
  await assert.rejects(update(host,{recruitment_count:1}),{code:'23514'});
});
test('outbox insertion failure rolls back the application decision',async()=>{
  const fourth='10000000-0000-4000-8000-000000000005';
  await db.query("insert into auth.users(id,email) values ($1,'fourth@dsm.hs.kr')",[fourth]);
  const a4=(await service("insert into public.applications(board_id,applicant_id,content) values ($1,$2,'지원') returning id",[board,fourth])).rows[0].id;
  await db.exec(`create function public.fail_email() returns trigger language plpgsql as $$ begin raise check_violation; end; $$;
    create trigger test_fail_email before insert on public.email_outbox for each row execute function public.fail_email();`);
  await assert.rejects(decide(host,a4,'rejected'),{code:'23514'});
  assert.equal((await service('select status from public.applications where id=$1',[a4])).rows[0].status,'pending');
  await db.exec('drop trigger test_fail_email on public.email_outbox;drop function public.fail_email();');
});
test('worker leases claim each queued email once and cascade deletes remain compatible',async()=>{
  const batch=await service('select * from public.claim_host_emails()');assert.equal(batch.rows.length,3);
  assert.ok(batch.rows.every(m=>m.lock_token && m.attempts===1));
  assert.equal((await service('select * from public.claim_host_emails()')).rows.length,0);
  await service('delete from public.boards where id=$1',[board]);
  assert.equal((await service('select * from public.applications')).rows.length,0);
  assert.equal((await service('select * from public.email_outbox')).rows.length,0);
});
