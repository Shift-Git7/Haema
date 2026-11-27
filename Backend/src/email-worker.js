import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { pathToFileURL } from 'node:url';

export async function sendBatch({ db, mailer, from, logger = console }) {
  const { data: messages, error } = await db.rpc('claim_host_emails');
  if (error) throw new Error('이메일 대기열을 가져오지 못했습니다.');
  for (const message of messages) {
    try {
      await mailer.sendMail({
        from, to: message.recipient,
        messageId: `<haema-${message.id}@haema.local>`,
        subject: '[Haema] 지원 결과 안내',
        text: `${message.event_name} 공고에 대한 지원이 ${message.status === 'accepted' ? '수락' : '거절'}되었습니다.\n마이페이지에서 결과를 확인해 주세요.`
      });
      const { error: saveError } = await db.from('email_outbox').update({
        sent_at: new Date().toISOString(), locked_at: null, lock_token: null, last_error: null
      }).eq('id', message.id).eq('lock_token', message.lock_token);
      if (saveError) throw new Error('발송 기록 저장 실패');
    } catch {
      const { error: retryError } = await db.from('email_outbox').update({
        locked_at: null, lock_token: null, last_error: 'Delivery or acknowledgement failed',
        next_attempt_at: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(message.attempts, 7))).toISOString()
      }).eq('id', message.id).eq('lock_token', message.lock_token);
      logger.error({ code: retryError ? 'EMAIL_RETRY_SAVE_FAILED' : 'EMAIL_DELIVERY_FAILED', id: message.id });
    }
  }
  return messages.length;
}

// One batch per invocation: schedule this command every minute in deployment.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM']) {
    if (!process.env[name]) throw new Error(`${name}을 설정해 주세요.`);
  }
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    requireTLS: process.env.SMTP_SECURE !== 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000
  });
  try { console.log(`처리한 이메일: ${await sendBatch({ db, mailer, from: process.env.MAIL_FROM })}`); }
  finally { mailer.close(); }
}
