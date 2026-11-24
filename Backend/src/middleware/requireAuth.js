import { supabase, createUserClient } from '../lib/supabase.js';

export async function requireAuth(req, res, next) {
  try {
    const authorization = req.get('authorization') ?? '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ error: '로그인 토큰이 필요합니다.' });
    }

    const accessToken = match[1];
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data.user) {
      return res.status(401).json({ error: '토큰이 유효하지 않거나 만료되었습니다.' });
    }

    req.authUser = data.user;
    req.supabase = createUserClient(accessToken);
    return next();
  } catch (error) {
    return next(error);
  }
}
