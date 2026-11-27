import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { boardRouter } from './routes/board.js';
import { profileRouter } from './routes/profile.js';
import { accountRouter } from './routes/account.js';
import { hostRouter } from './routes/host.js';
import { applicationRouter } from './routes/application.js';

export const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json({ limit: '32kb' }));

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));
app.use('/common', authRouter);
// 게시판 조회도 로그인한 사용자만 이용할 수 있습니다.
app.use('/common', boardRouter);
app.use('/common', accountRouter);
app.use('/common', profileRouter);
// 호스트(모집자) 전용 엔드포인트
app.use('/host', hostRouter);
// 지원자 전용 지원/상태/취소 엔드포인트
app.use('/app', applicationRouter);

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: '올바른 JSON이 필요합니다.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: '요청 크기가 너무 큽니다.' });
  console.error('Unhandled API error:', err?.message ?? 'unknown');
  return res.status(500).json({ error: '서버에서 요청을 처리하지 못했습니다.' });
});
