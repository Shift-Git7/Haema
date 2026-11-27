import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
process.env.SUPABASE_URL ??= 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY ??= 'test-key';
const { createHostRouter } = await import('../src/routes/host.js');
const owner = '10000000-0000-4000-8000-000000000001';
const id = '10000000-0000-4000-8000-000000000002';
const input = {eventName:'해커톤',deadline:'2026-12-20',sourceUrl:'https://example.com',title:'모집',recruitingContent:'팀원 모집',recruitmentCount:2,contactEmail:'host@test.com'};
function fixture({missing=false,dbError=null,verified=true,admin=true}={}) {
  const calls=[];
  const row={id,owner_id:owner,event_name:input.eventName,deadline:input.deadline,source_url:input.sourceUrl,title:input.title,recruiting_content:input.recruitingContent,recruitment_count:2,contact_email:input.contactEmail,board_id:id,content:'지원',status:'pending'};
  const db={
    from(table) {
      const call={table,filters:[]};calls.push(call);
      return {
        select(value) {call.select=value;return this;},eq(...args) {call.filters.push(args);return this;},
        order(...args) {(call.orders??=[]).push(args);return this;},range(...args) {call.range=args;return this;},
        insert(value) {call.insert=value;return this;},delete() {call.delete=true;return this;},
        single() {return Promise.resolve({data:row,error:dbError});},
        maybeSingle() {return Promise.resolve({data:missing?null:row,error:dbError});},
        then(resolve,reject) {return Promise.resolve({data:missing?[]:[row],error:dbError}).then(resolve,reject);}
      };
    },
    async rpc(name,args) {calls.push({rpc:name,args});return {data:{...row,status:args.p_status??'pending'},error:dbError};}
  };
  const app=express();app.use(express.json({limit:'32kb'}));
  app.use('/host',createHostRouter({createAdmin:()=>admin?db:null,authenticate(req,res,next) {
    if(req.get('authorization')!=='Bearer test') return res.status(401).json({error:'로그인 필요'});
    req.authUser={id:owner,email_confirmed_at:verified?'2026-01-01':null};next();
  }}));
  const auth=(method,path)=>request(app)[method](path).set('Authorization','Bearer test');
  return {app,auth,calls};
}
test('all host routes require login; unconfirmed user and missing admin config are blocked',async()=>{
  const {app}=fixture();
  for(const [method,path] of [['get','/host/board'],['post','/host/board'],['get',`/host/board/${id}`],['patch',`/host/board/${id}`],['delete',`/host/board/${id}`],['get',`/host/app/list?boardId=${id}`],['get',`/host/app/${id}`],['patch',`/host/app/${id}`]]) await request(app)[method](path).expect(401);
  await fixture({verified:false}).auth('get','/host/board').expect(403);
  await fixture({admin:false}).auth('get','/host/board').expect(503);
});
test('create uses existing camelCase contract and server-controlled owner; rejects invalid input',async()=>{
  const {auth,calls}=fixture();
  const response=await auth('post','/host/board').send(input).expect(201);
  assert.equal(response.body.board.eventName,input.eventName);
  assert.equal(response.body.board.owner_id,undefined);
  assert.equal(calls[0].insert.owner_id,owner);
  assert.equal(calls[0].insert.deadline,input.deadline);
  for(const bad of [{...input,ownerId:id},{...input,recruitmentCount:0},{...input,recruitmentCount:'2'},{...input,deadline:'2026-02-30'},{...input,sourceUrl:'javascript:alert(1)'},{...input,title:' '},{...input,contactEmail:'invalid'},{}]) await auth('post','/host/board').send(bad).expect(400);
});
test('list, detail and delete explicitly scope by verified owner',async()=>{
  const {auth,calls}=fixture();
  const response=await auth('get','/host/board?limit=5&offset=10').expect(200);
  assert.deepEqual(response.body.pagination,{limit:5,offset:10});
  assert.deepEqual(calls[0].filters,[['owner_id',owner]]);
  assert.deepEqual(calls[0].range,[10,14]);
  assert.deepEqual(calls[0].orders[0],['created_at',{ascending:false}]);
  await auth('get',`/host/board/${id}`).expect(200);
  await auth('delete',`/host/board/${id}`).expect(204);
  for(const c of calls.slice(1)) assert.deepEqual(c.filters,[['id',id],['owner_id',owner]]);
  await fixture({missing:true}).auth('get',`/host/board/${id}`).expect(404);
  await fixture({missing:true}).auth('delete',`/host/board/${id}`).expect(404);
  for(const query of ['limit=0','limit=101','offset=-1','limit=1&limit=2']) await auth('get',`/host/board?${query}`).expect(400);
});
test('board update and application decisions pass verified owner into transaction RPCs',async()=>{
  const {auth,calls}=fixture();
  await auth('patch',`/host/board/${id}`).send({title:'수정'}).expect(200);
  assert.deepEqual(calls[0],{rpc:'update_host_board',args:{p_owner_id:owner,p_board_id:id,p_patch:{title:'수정'}}});
  await auth('patch',`/host/app/${id}`).send({status:'accepted'}).expect(200);
  assert.deepEqual(calls[1],{rpc:'decide_host_application',args:{p_owner_id:owner,p_application_id:id,p_status:'accepted'}});
  await auth('patch',`/host/app/${id}`).send({status:'rejected'}).expect(200);
  await auth('patch',`/host/app/${id}`).send({status:'pending'}).expect(400);
  await auth('patch',`/host/board/${id}`).send({}).expect(400);
  await fixture({dbError:{code:'23514'}}).auth('patch',`/host/app/${id}`).send({status:'accepted'}).expect(409);
});
test('application list verifies board ownership and detail filters joined owner without leaking identities',async()=>{
  const {auth,calls}=fixture();
  await auth('get',`/host/app/list?boardId=${id}`).expect(200);
  assert.deepEqual(calls[0].filters,[['id',id],['owner_id',owner]]);
  assert.deepEqual(calls[1].filters,[['board_id',id]]);
  const response=await auth('get',`/host/app/${id}`).expect(200);
  assert.deepEqual(calls[2].filters,[['id',id],['boards.owner_id',owner]]);
  assert.equal(response.body.application.statusLabel,'검토 중');
  assert.equal(response.body.application.owner_id,undefined);
  assert.equal(response.body.application.applicant_id,undefined);
  await fixture({missing:true}).auth('get',`/host/app/list?boardId=${id}`).expect(404);
  await auth('get','/host/app/list').expect(400);
  await auth('get','/host/app/not-uuid').expect(400);
  const unavailable=await fixture({dbError:{code:'UNKNOWN',message:'secret'}}).auth('get','/host/board').expect(503);
  assert.equal(JSON.stringify(unavailable.body).includes('secret'),false);
});
