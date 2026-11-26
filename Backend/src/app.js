import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { profileRouter } from './routes/profile.js';
import { accountRouter } from './routes/account.js';

export const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json({ limit: '32kb' }));

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));
app.use('/common', authRouter);
app.use('/common', profileRouter);
app.use('/common', accountRouter);

app.use((err, _req, res, _next) => {
  console.error('Unhandled API error:', err?.message ?? 'unknown');
  return res.status(500).json({ error: '서버에서 요청을 처리하지 못했습니다.' });
});
