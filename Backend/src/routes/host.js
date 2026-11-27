import { Router } from 'express';
import { createAdminClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { checkDb, HttpError } from '../host/errors.js';
import { boardInput, uuid, pagination, decision } from '../host/validation.js';

const boardColumns = 'id,owner_id,event_name,deadline,source_url,title,recruiting_content,recruitment_count,contact_email,created_at,updated_at';
const applicationColumns = 'id,board_id,content,status,created_at,updated_at';
const toBoard = (b) => ({id:b.id,eventName:b.event_name,deadline:b.deadline,sourceUrl:b.source_url,title:b.title,recruitingContent:b.recruiting_content,recruitmentCount:b.recruitment_count,contactEmail:b.contact_email,createdAt:b.created_at,updatedAt:b.updated_at});
const toApplication = (a) => ({id:a.id,boardId:a.board_id,content:a.content,status:a.status,statusLabel:{pending:'검토 중',accepted:'합격',rejected:'탈락'}[a.status],createdAt:a.created_at,updatedAt:a.updated_at});
async function ownBoard(req, id) {
  const {data,error} = await req.hostDb.from('boards').select(boardColumns).eq('id',id).eq('owner_id',req.authUser.id).maybeSingle();
  checkDb(error);
  if (!data) throw new HttpError(404,'NOT_FOUND','내 공고를 찾을 수 없습니다.');
  return data;
}
export function createHostRouter({authenticate = requireAuth, createAdmin = createAdminClient} = {}) {
  const router = Router();
  router.use((req,res,next) => {res.set('Cache-Control','no-store');next();});
  router.use(authenticate);
  router.use((req,res,next) => {
    if (!req.authUser.email_confirmed_at || req.authUser.is_anonymous) throw new HttpError(403,'EMAIL_UNVERIFIED','이메일 인증이 필요합니다.');
    req.hostDb = createAdmin();
    if (!req.hostDb) throw new HttpError(503,'DATABASE_UNAVAILABLE','서버의 Supabase service-role 설정이 필요합니다.');
    next();
  });
  router.get('/board', async (req,res) => {
    const p = pagination(req.query);
    const {data,error} = await req.hostDb.from('boards').select(boardColumns).eq('owner_id',req.authUser.id)
      .order('created_at',{ascending:false}).order('id',{ascending:false}).range(p.offset,p.offset+p.limit-1);
    checkDb(error);
    res.json({items:(data??[]).map(toBoard),pagination:p});
  });
  router.post('/board', async (req,res) => {
    const input = boardInput(req.body);
    const {data,error} = await req.hostDb.from('boards').insert({...input,owner_id:req.authUser.id}).select(boardColumns).single();
    checkDb(error);
    res.location(`/host/board/${data.id}`).status(201).json({board:toBoard(data)});
  });
  router.get('/board/:id', async (req,res) => res.json({board:toBoard(await ownBoard(req,uuid(req.params.id)))}));
  router.patch('/board/:id', async (req,res) => {
    const id = uuid(req.params.id);
    const patch = boardInput(req.body,true);
    const {data,error} = await req.hostDb.rpc('update_host_board',{p_owner_id:req.authUser.id,p_board_id:id,p_patch:patch});
    checkDb(error);
    res.json({board:toBoard(data)});
  });
  router.delete('/board/:id', async (req,res) => {
    const id = uuid(req.params.id);
    const {data,error} = await req.hostDb.from('boards').delete().eq('id',id).eq('owner_id',req.authUser.id).select('id').maybeSingle();
    checkDb(error);
    if (!data) throw new HttpError(404,'NOT_FOUND','내 공고를 찾을 수 없습니다.');
    res.status(204).end();
  });
  router.get('/app/list', async (req,res) => {
    const p = pagination(req.query,['boardId']);
    const boardId = uuid(req.query.boardId);
    await ownBoard(req,boardId);
    const {data,error} = await req.hostDb.from('applications').select(applicationColumns).eq('board_id',boardId)
      .order('created_at',{ascending:false}).order('id',{ascending:false}).range(p.offset,p.offset+p.limit-1);
    checkDb(error);
    res.json({items:(data??[]).map(toApplication),pagination:p});
  });
  router.get('/app/:id', async (req,res) => {
    const id = uuid(req.params.id);
    const {data,error} = await req.hostDb.from('applications').select(`${applicationColumns},boards!inner(owner_id)`)
      .eq('id',id).eq('boards.owner_id',req.authUser.id).maybeSingle();
    checkDb(error);
    if (!data) throw new HttpError(404,'NOT_FOUND','지원서를 찾을 수 없습니다.');
    res.json({application:toApplication(data)});
  });
  router.patch('/app/:id', async (req,res) => {
    const id = uuid(req.params.id);
    const status = decision(req.body);
    const {data,error} = await req.hostDb.rpc('decide_host_application',{p_owner_id:req.authUser.id,p_application_id:id,p_status:status});
    checkDb(error);
    res.json({application:toApplication(data)});
  });
  router.use((err,req,res,next) => {
    if (!(err instanceof HttpError)) return next(err);
    res.status(err.status).json({error:err.message,code:err.code});
  });
  return router;
}
export const hostRouter = createHostRouter();
