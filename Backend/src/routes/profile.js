import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';

export const profileRouter = Router();
profileRouter.use(requireAuth);

profileRouter.get('/mypage/:id', async (req, res, next) => {
  try {
    if (req.params.id !== req.authUser.id) {
      return res.status(403).json({ error: '본인의 마이페이지 정보만 조회할 수 있습니다.' });
    }
    const { data, error } = await req.supabase
      .from('profiles')
      .select('id, major, awards, created_at')
      .eq('id', req.authUser.id)
      .maybeSingle();

    if (error) return next(error);
    if (!data) return res.status(404).json({ error: '프로필을 찾을 수 없습니다.' });
    return res.json({ profile: data });
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
