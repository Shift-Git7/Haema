import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { createAdminClient } from '../lib/supabase.js';

export const profileRouter = Router();
profileRouter.use(requireAuth);

profileRouter.get('/mypage/:id', async (req, res, next) => {
  try {
    if (req.params.id !== req.authUser.id) {
      return res.status(403).json({ error: '본인의 마이페이지 정보만 조회할 수 있습니다.' });
    }
    const admin = createAdminClient();
    if (!admin) {
      return res.status(503).json({ error: '마이페이지 활동 내역 조회에 필요한 서버의 Supabase service-role 설정이 없습니다.' });
    }

    const [profileResult, createdResult, appliedResult] = await Promise.all([
      req.supabase.from('profiles').select('id, major, awards, created_at').eq('id', req.authUser.id).maybeSingle(),
      admin.from('boards').select('id, event_name, title, deadline, recruitment_count, created_at')
        .eq('owner_id', req.authUser.id).order('created_at', { ascending: false }),
      admin.from('applications')
        .select('id, status, created_at, board:boards(id, event_name, title, deadline, source_url, recruitment_count, created_at)')
        .eq('applicant_id', req.authUser.id).order('created_at', { ascending: false }),
    ]);

    if (profileResult.error) return next(profileResult.error);
    if (createdResult.error) return next(createdResult.error);
    if (appliedResult.error) return next(appliedResult.error);
    if (!profileResult.data) return res.status(404).json({ error: '프로필을 찾을 수 없습니다.' });

    const statusLabels = { pending: '검토 중', accepted: '합격', rejected: '탈락' };
    return res.json({
      profile: profileResult.data,
      createdBoards: (createdResult.data ?? []).map((board) => ({
        id: board.id,
        eventName: board.event_name,
        title: board.title,
        deadline: board.deadline,
        recruitmentCount: board.recruitment_count,
        createdAt: board.created_at,
      })),
      appliedBoards: (appliedResult.data ?? []).map((application) => ({
        applicationId: application.id,
        status: application.status,
        statusLabel: statusLabels[application.status] ?? application.status,
        appliedAt: application.created_at,
        board: application.board ? {
          id: application.board.id,
          eventName: application.board.event_name,
          title: application.board.title,
          deadline: application.board.deadline,
          sourceUrl: application.board.source_url,
          recruitmentCount: application.board.recruitment_count,
          createdAt: application.board.created_at,
        } : null,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

profileRouter.get('/record', async (req, res, next) => {
  try {
    const { data, error } = await req.supabase
      .from('profiles')
      .select('major, awards')
      .eq('id', req.authUser.id)
      .maybeSingle();
    if (error) return next(error);
    if (!data) return res.status(404).json({ error: '이력 정보를 찾을 수 없습니다.' });
    return res.json({ record: data });
  } catch (error) {
    return next(error);
  }
});

profileRouter.patch('/record/:id', async (req, res, next) => {
  try {
    if (req.params.id !== req.authUser.id) {
      return res.status(403).json({ error: '본인의 이력 정보만 수정할 수 있습니다.' });
    }
    const updates = {};
    if (Object.hasOwn(req.body ?? {}, 'major')) updates.major = req.body.major;
    if (Object.hasOwn(req.body ?? {}, 'awards')) updates.awards = req.body.awards;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: '수정할 전공 또는 수상 경력을 입력해 주세요.' });
    }
    for (const value of Object.values(updates)) {
      if (typeof value !== 'string' || value.length > 5000) {
        return res.status(400).json({ error: '전공과 수상 경력은 각각 5,000자 이내의 문자열이어야 합니다.' });
      }
    }

    const { data, error } = await req.supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.authUser.id)
      .select('id, major, awards')
      .maybeSingle();
    if (error) return next(error);
    if (!data) return res.status(404).json({ error: '수정할 이력 정보를 찾을 수 없습니다.' });
    return res.json({ record: data });
  } catch (error) {
    return next(error);
  }
});
