import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const userId = '11111111-1111-4111-8111-111111111111';
const user = {
  id: userId,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'student@dsm.hs.kr',
  app_metadata: {},
  user_metadata: { major: '컴퓨터공학', awards: '해커톤 우수상' },
  created_at: '2026-01-01T00:00:00.000Z',
};
let fakeSupabase;
let api;
let apiUrl;
let lastSignupBody;
let lastProfileUpdate;

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

before(async () => {
  fakeSupabase = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let body;
    if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString();
      body = raw ? JSON.parse(raw) : {};
    }

    const send = (status, payload) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    };

    if (req.method === 'POST' && url.pathname === '/auth/v1/signup') {
      lastSignupBody = body;
      return send(200, user);
    }
    if (req.method === 'POST' && url.pathname === '/auth/v1/token') {
      return send(200, {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token-must-not-leak',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: 1900000000,
        user,
      });
    }
    if (req.method === 'GET' && url.pathname === '/auth/v1/user') {
      if (req.headers.authorization !== 'Bearer mock-access-token') return send(401, { message: 'Invalid token' });
      return send(200, user);
    }
    if (url.pathname === '/rest/v1/profiles' && req.method === 'GET') {
      if (url.searchParams.get('select') === 'major,awards') return send(200, { major: '컴퓨터공학', awards: '해커톤 우수상' });
      return send(200, { id: userId, major: '컴퓨터공학', awards: '해커톤 우수상', created_at: user.created_at });
    }
    if (url.pathname === '/rest/v1/profiles' && req.method === 'PATCH') {
      lastProfileUpdate = body;
      return send(200, { id: userId, major: body.major ?? '컴퓨터공학', awards: body.awards ?? '해커톤 우수상' });
    }
    if (req.method === 'GET' && url.pathname === `/auth/v1/admin/users/${userId}`) return send(200, user);
    if (req.method === 'DELETE' && url.pathname === `/auth/v1/admin/users/${userId}`){ res.writeHead(204); return res.end(); }
    return send(404, { message: `Unhandled mock request ${req.method} ${url.pathname}` });
  });

  const fakePort = await listen(fakeSupabase);
  process.env.SUPABASE_URL = `http://127.0.0.1:${fakePort}`;
  process.env.SUPABASE_ANON_KEY = 'test-publishable-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.CORS_ORIGINS = 'http://localhost:5173';

  const { app } = await import('../src/app.js');
  const apiServer = http.createServer(app);
  const apiPort = await listen(apiServer);
  api = apiServer;
  apiUrl = `http://127.0.0.1:${apiPort}`;
});

after(async () => {
  if (api) await close(api);
  if (fakeSupabase) await close(fakeSupabase);
});

test('rejects non-school addresses and passwords that do not meet policy', async () => {
  const wrongDomain = await fetch(`${apiUrl}/common/sign-up`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'student@notdsm.hs.kr', password: 'Example!234', passwordConfirm: 'Example!234' }),
  });
  assert.equal(wrongDomain.status, 400);

  const weakPassword = await fetch(`${apiUrl}/common/sign-up`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'student@dsm.hs.kr', password: 'example1234', passwordConfirm: 'example1234' }),
  });
  assert.equal(weakPassword.status, 400);
  assert.match((await weakPassword.json()).details.join(' '), /대문자/);
});

test('signs up school email, sends profile metadata, and does not issue a token', async () => {
  const response = await fetch(`${apiUrl}/common/sign-up`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: ' Student@DSM.HS.KR ', password: 'Example!234', passwordConfirm: 'Example!234', major: '컴퓨터공학', awards: '해커톤 우수상' }),
  });
  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.equal(payload.emailConfirmationRequired, true);
  assert.equal(payload.confirmationPending, true);
  assert.equal('accessToken' in payload, false);
  assert.equal(lastSignupBody.email, 'student@dsm.hs.kr');
  assert.deepEqual(lastSignupBody.data, { major: '컴퓨터공학', awards: '해커톤 우수상' });
});

test('login returns access token only', async () => {
  const response = await fetch(`${apiUrl}/common/log-in`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: 'Example!234' }),
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.accessToken, 'mock-access-token');
  assert.equal(payload.userId, userId);
  assert.equal('refreshToken' in payload, false);
  assert.equal(JSON.stringify(payload).includes('mock-refresh-token-must-not-leak'), false);
});

test('protects profile routes and allows only the token owner to edit records', async () => {
  assert.equal((await fetch(`${apiUrl}/common/record`)).status, 401);
  const headers = { authorization: 'Bearer mock-access-token' };
  const record = await fetch(`${apiUrl}/common/record`, { headers });
  assert.equal(record.status, 200);
  assert.deepEqual(await record.json(), { record: { major: '컴퓨터공학', awards: '해커톤 우수상' } });

  const foreignPage = await fetch(`${apiUrl}/common/mypage/22222222-2222-4222-8222-222222222222`, { headers });
  assert.equal(foreignPage.status, 403);

  const update = await fetch(`${apiUrl}/common/record/${userId}`, {
    method: 'PATCH', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ major: '소프트웨어', email: 'attacker@example.com' }),
  });
  assert.equal(update.status, 200);
  assert.deepEqual(lastProfileUpdate, { major: '소프트웨어' });
});

test('withdraws the authenticated account through Supabase admin API', async () => {
  const response = await fetch(`${apiUrl}/common/account`, {
    method: 'DELETE', headers: { authorization: 'Bearer mock-access-token' },
  });
  assert.equal(response.status, 204);
});
