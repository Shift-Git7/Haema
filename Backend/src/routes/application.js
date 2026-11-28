import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { createAdminClient } from '../lib/supabase.js';

export const applicationRouter = Router();
applicationRouter.use(requireAuth);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function admin() {
  const adminClient = createAdminClient();
  if (!adminClient) {
    throw new Error('서비스 역할 키가 설정되어 있지 않습니다.');
  }
  return adminClient;
}

// POST /app/record/:boardId - 지원서 작성하여 모집 공고에 지원 (상태: pending)
applicationRouter.post('/record/:boardId', async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const { content } = req.body ?? {};
    const applicantId = req.authUser.id;

    if (!UUID_PATTERN.test(boardId)) {
      return res.status(400).json({ error: '올바른 모집 공고 ID가 아닙니다.' });
    }
    if (typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: '지원서 내용을 입력해 주세요.' });
    }

    const supabase = admin();
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('id')
      .eq('id', boardId)
      .maybeSingle();
    if (boardError) return next(boardError);
    if (!board) return res.status(404).json({ error: '모집 공고를 찾을 수 없습니다.' });

    let record;
    try {
      const { data, error } = await supabase
        .from('applications')
        .insert({ board_id: boardId, applicant_id: applicantId, content, status: 'pending' })
        .select('id, board_id, applicant_id, content, status, created_at, updated_at');
      if (error) return next(error);
      const rows = Array.isArray(data) ? data : (data?.data ?? []);
      record = rows[0] ?? null;
    } catch (error) {
      if (error?.code === '23505') {
        return res.status(409).json({ error: '이미 지원한 공고입니다.' });
      }
      throw error;
    }

    if (!record) return res.status(500).json({ error: '지원 내역을 생성하지 못했습니다.' });
    return res.status(201).json({ application: record });
  } catch (error) {
    return next(error);
  }
});

// GET /app/record - 마이페이지 > 내가 지원한 공고 목록
applicationRouter.get('/record', async (req, res, next) => {
  try {
    const applicantId = req.authUser.id;
    const supabase = admin();
    const { data, error } = await supabase
      .from('applications')
      .select('id, board_id, content, status, created_at, updated_at, boards(id, event_name, deadline, source_url, title, recruiting_content, recruitment_count, contact_email)')
      .eq('applicant_id', applicantId)
      .order('created_at', { ascending: false });
    if (error) return next(error);
    const rows = Array.isArray(data) ? data : (data?.data ?? []);
    return res.json({ applications: rows });
  } catch (error) {
    return next(error);
  }
});

// GET /app/record/state/:boardId - 지원 처리 상태 조회 (pending / accepted / rejected)
applicationRouter.get('/record/state/:boardId', async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const applicantId = req.authUser.id;
    if (!UUID_PATTERN.test(boardId)) {
      return res.status(400).json({ error: '올바른 모집 공고 ID가 아닙니다.' });
    }
    const supabase = admin();
    const { data, error } = await supabase
      .from('applications')
      .select('status')
      .eq('applicant_id', applicantId)
      .eq('board_id', boardId)
      .maybeSingle();
    if (error) return next(error);
    if (!data) return res.status(404).json({ error: '지원 내역을 찾을 수 없습니다.' });
    return res.json({ status: data.status });
  } catch (error) {
    return next(error);
  }
});

// DELETE /app/record/:boardId - 지원 취소 (지원 내역 및 지원서 삭제)
applicationRouter.delete('/record/:boardId', async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const applicantId = req.authUser.id;
    if (!UUID_PATTERN.test(boardId)) {
      return res.status(400).json({ error: '올바른 모집 공고 ID가 아닙니다.' });
    }
    const supabase = admin();
    const { error } = await supabase
      .from('applications')
      .delete()
      .eq('applicant_id', applicantId)
      .eq('board_id', boardId);
    if (error) return next(error);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});
