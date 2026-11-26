import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { createAdminClient } from '../lib/supabase.js';

export const accountRouter = Router();
accountRouter.delete('/account', requireAuth, async (req, res, next) => {
  try {
    const admin = createAdminClient();
    if (!admin) {
      return res.status(503).json({ error: '계정 탈퇴 기능을 사용할 수 없습니다. 서버의 Supabase 설정을 확인해 주세요.' });
    }

    const { error } = await admin.auth.admin.deleteUser(req.authUser.id);
    if (error) {
      console.error('Supabase account deletion error:', error.code ?? 'unknown');
      return res.status(500).json({ error: '회원 탈퇴를 처리하지 못했습니다.' });
    }
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});
