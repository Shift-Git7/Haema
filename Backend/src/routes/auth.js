import { Router } from 'express';
import { config } from '../config.js';
import { getPasswordPolicyErrors } from '../lib/passwordPolicy.js';
import { supabase } from '../lib/supabase.js';

export const authRouter = Router();
const SCHOOL_DOMAIN = 'dsm.hs.kr';

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isSchoolEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  const domain = email.slice(email.lastIndexOf('@') + 1);
  return domain === SCHOOL_DOMAIN || domain.endsWith(`.${SCHOOL_DOMAIN}`);
}

function validateProfileText(major, awards) {
  if (typeof major !== 'string' || typeof awards !== 'string') {
    return '전공과 수상 경력은 문자열로 입력해 주세요.';
  }
  if (major.length > 5000 || awards.length > 5000) {
    return '전공과 수상 경력은 각각 5,000자 이내로 입력해 주세요.';
  }
  return null;
}

authRouter.post('/sign-up', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const { password, passwordConfirm } = req.body ?? {};
    const major = req.body?.major ?? '';
    const awards = req.body?.awards ?? '';

    if (!email || email.length > 254 || !isSchoolEmail(email)) {
      return res.status(400).json({ error: 'dsm.hs.kr 학교 이메일 주소를 사용해 주세요.' });
    }
    if (typeof password !== 'string' || typeof passwordConfirm !== 'string') {
      return res.status(400).json({ error: '비밀번호와 비밀번호 확인을 입력해 주세요.' });
    }
    if (password !== passwordConfirm) {
      return res.status(400).json({ error: '비밀번호와 비밀번호 확인이 일치하지 않습니다.' });
    }
    const profileError = validateProfileText(major, awards);
    if (profileError) return res.status(400).json({ error: profileError });

    const passwordErrors = getPasswordPolicyErrors(password);
    if (passwordErrors.length) {
      return res.status(400).json({ error: '비밀번호 조건을 확인해 주세요.', details: passwordErrors });
    }

    const options = { data: { major, awards } };
    if (config.emailRedirectUrl) options.emailRedirectTo = config.emailRedirectUrl;
    const { data, error } = await supabase.auth.signUp({ email, password, options });
    if (error) {
      // Keep the response generic to avoid disclosing whether an account already exists.
      console.warn('Supabase signup error:', error.code ?? 'unknown');
      return res.status(400).json({ error: '회원가입을 처리하지 못했습니다. 이메일과 입력 내용을 확인해 주세요.' });
    }

    return res.status(201).json({
      message: '인증 메일을 보냈습니다. 이메일의 링크를 눌러 가입을 완료해 주세요.',
      emailConfirmationRequired: true,
      confirmationPending: !data.session,
    });
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/log-in', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const { password } = req.body ?? {};
    if (!email || typeof password !== 'string' || !password) {
      return res.status(400).json({ error: '이메일과 비밀번호를 입력해 주세요.' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      return res.status(401).json({ error: '이메일 또는 비밀번호를 확인해 주세요. 이메일 인증이 완료되지 않았을 수도 있습니다.' });
    }

    return res.status(200).json({
      accessToken: data.session.access_token,
      tokenType: data.session.token_type,
      expiresAt: data.session.expires_at,
      userId: data.user.id,
    });
  } catch (error) {
    return next(error);
  }
});
