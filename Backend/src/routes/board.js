import { Router } from 'express';
import { createAdminClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const boardRouter = Router();
boardRouter.use(requireAuth);
const BOARD_FIELDS = 'id, event_name, deadline, source_url, title, recruiting_content, recruitment_count, contact_email, created_at';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toPublicBoard(row) {
  return {
    id: row.id,
    eventName: row.event_name,
    deadline: row.deadline,
    sourceUrl: row.source_url,
    title: row.title,
    recruitingContent: row.recruiting_content,
    recruitmentCount: row.recruitment_count,
    // 회원가입 이메일이 아니라 게시글에 별도로 입력한 연락처입니다.
    contactEmail: row.contact_email,
    createdAt: row.created_at,
  };
}

function parsePagination(query) {
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  const offset = query.offset === undefined ? 0 : Number(query.offset);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return null;
  if (!Number.isInteger(offset) || offset < 0 || offset > 100000) return null;
  return { limit, offset };
}

boardRouter.get('/board', async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    if (!pagination) return res.status(400).json({ error: 'limit은 1~100, offset은 0 이상의 정수여야 합니다.' });
    const admin = createAdminClient();
    if (!admin) return res.status(503).json({ error: '공고 조회에 필요한 서버의 Supabase service-role 설정이 없습니다.' });

    const { data, error } = await admin.from('boards').select(BOARD_FIELDS)
      .order('created_at', { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.limit - 1);
    if (error) return next(error);
    return res.json({ items: (data ?? []).map(toPublicBoard), pagination });
  } catch (error) {
    return next(error);
  }
});

boardRouter.get('/board/:id', async (req, res, next) => {
  try {
    if (!UUID_PATTERN.test(req.params.id)) return res.status(400).json({ error: '올바른 모집 공고 ID가 아닙니다.' });
    const admin = createAdminClient();
    if (!admin) return res.status(503).json({ error: '공고 조회에 필요한 서버의 Supabase service-role 설정이 없습니다.' });

    const { data, error } = await admin.from('boards').select(BOARD_FIELDS).eq('id', req.params.id).maybeSingle();
    if (error) return next(error);
    if (!data) return res.status(404).json({ error: '모집 공고를 찾을 수 없습니다.' });
    return res.json({ board: toPublicBoard(data) });
  } catch (error) {
    return next(error);
  }
});

