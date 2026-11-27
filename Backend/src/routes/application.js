import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';

export const applicationRouter = Router();
applicationRouter.use(requireAuth);

// POST /app/record/:postId - 지원서 작성하여 모집 공고에 지원
applicationRouter.post('/record/:postId', async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { content } = req.body ?? {};
    const userId = req.authUser.id;

    if (typeof postId !== 'string' || postId.length === 0) {
      return res.status(400).json({ error: '공고 ID가 필요합니다.' });
    }
    if (typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: '지원서 내용을 입력해 주세요.' });
    }

    const { data: postData, error: postError } = await req.supabase
      .from('posts')
      .select('id')
      .eq('id', postId);
    if (postError) return next(postError);
    const posts = Array.isArray(postData) ? postData : (postData?.data ?? []);
    if (!posts[0]) return res.status(404).json({ error: '모집 공고를 찾을 수 없습니다.' });

    let record;
    try {
      const { data, error } = await req.supabase
        .from('applications')
        .insert({ user_id: userId, post_id: postId, content, state: '검토 중' })
        .select('id, user_id, post_id, content, state, created_at, updated_at');
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
    const userId = req.authUser.id;
    const { data, error } = await req.supabase
      .from('applications')
      .select('id, post_id, content, state, created_at, updated_at, posts(id, title, competition_name, deadline, contact)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) return next(error);
    const rows = Array.isArray(data) ? data : (data?.data ?? []);
    return res.json({ applications: rows });
  } catch (error) {
    return next(error);
  }
});

// GET /app/record/state/:postId - 지원 처리 상태 조회 (검토 중 / 합격 / 탈락)
applicationRouter.get('/record/state/:postId', async (req, res, next) => {
  try {
    const { postId } = req.params;
    const userId = req.authUser.id;
    const { data, error } = await req.supabase
      .from('applications')
      .select('state')
      .eq('user_id', userId)
      .eq('post_id', postId);
    if (error) return next(error);
    const rows = Array.isArray(data) ? data : (data?.data ?? []);
    const record = rows[0] ?? null;
    if (!record) return res.status(404).json({ error: '지원 내역을 찾을 수 없습니다.' });
    return res.json({ state: record.state });
  } catch (error) {
    return next(error);
  }
});

// DELETE /app/record/:postId - 지원 취소 (지원 내역 및 지원서 삭제)
applicationRouter.delete('/record/:postId', async (req, res, next) => {
  try {
    const { postId } = req.params;
    const userId = req.authUser.id;
    const { error } = await req.supabase
      .from('applications')
      .delete()
      .eq('user_id', userId)
      .eq('post_id', postId);
    if (error) return next(error);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});
