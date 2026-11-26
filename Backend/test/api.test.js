import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const userId = '11111111-1111-4111-8111-111111111111';
const boardId = '22222222-2222-4222-8222-222222222222';
const applicationId = '33333333-3333-4333-8333-333333333333';
const user = {
  id: userId,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'student@dsm.hs.kr',
  app_metadata: {},
  user_metadata: { major: '컴퓨터공학', awards: '해커톤 우수상' },
  created_at: '2026-01-01T00:00:00.000Z',
};
const board = {
  id: boardId,
  owner_id: userId,
  event_name: '대덕 해커톤',
  deadline: '2026-12-20',
  source_url: 'https://example.com/event',
  title: '프론트엔드 팀원 모집',
  recruiting_content: 'React 경험자를 모집합니다.',
  recruitment_count: 2,
  contact_email: 'team-contact@example.com',
  created_at: '2026-11-25T10:00:00.000Z',
};
const application = {
  id: applicationId,
  status: 'accepted',
  created_at: '2026-11-26T10:00:00.000Z',
  board: {
    id: boardId,
    event_name: board.event_name,
    title: board.title,
    deadline: board.deadline,
    source_url: board.source_url,
    recruitment_count: board.recruitment_count,
    created_at: board.created_at,
  },
};
let fakeSupabase;
let api;
let apiUrl;
let lastSignupBody;
let lastProfileUpdate;
let lastBoardQuery;
let lastBoardRange;
let lastApplicationQuery;

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
    if (url.pathname === '/rest/v1/boards' && req.method === 'GET') {
      lastBoardQuery = url.searchParams;
      lastBoardRange = req.headers.range;
      if (url.searchParams.has('id')) return send(200, board);
      return send(200, [board]);
    }
    if (url.pathname === '/rest/v1/applications' && req.method === 'GET') {
      lastApplicationQuery = url.searchParams;
      return send(200, [application]);
    }
    if (req.method === 'GET' && url.pathname === `/auth/v1/admin/users/${userId}`) return send(200, user);
    if (req.method === 'DELETE' && url.pathname === `/auth/v1/admin/users/${userId}`) {
      res.writeHead(204);
      return res.end();
    }
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

test('requires login to read board list and hides author identity', async () => {
  const anonymousResponse = await fetch(`${apiUrl}/common/board?limit=5&offset=10`);
  assert.equal(anonymousResponse.status, 401);
  const response = await fetch(`${apiUrl}/common/board?limit=5&offset=10`, { headers: { authorization: 'Bearer mock-access-token' } });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.pagination, { limit: 5, offset: 10 });
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].eventName, '대덕 해커톤');
  assert.equal(payload.items[0].deadline, '2026-12-20');
  assert.equal(payload.items[0].contactEmail, 'team-contact@example.com');
  assert.equal('owner_id' in payload.items[0], false);
  assert.equal('ownerId' in payload.items[0], false);
  assert.equal(lastBoardQuery.get('order'), 'created_at.desc');
  assert.equal(lastBoardQuery.get('offset'), '10');
  assert.equal(lastBoardQuery.get('limit'), '5');
});

test('requires login to read board detail and rejects malformed board IDs', async () => {
  const anonymousResponse = await fetch(`${apiUrl}/common/board/${boardId}`);
  assert.equal(anonymousResponse.status, 401);
  const headers = { authorization: 'Bearer mock-access-token' };
  const response = await fetch(`${apiUrl}/common/board/${boardId}`, { headers });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.board.title, '프론트엔드 팀원 모집');
  assert.equal(payload.board.sourceUrl, 'https://example.com/event');
  assert.equal('owner_id' in payload.board, false);

  const invalidId = await fetch(`${apiUrl}/common/board/not-a-uuid`, { headers });
  assert.equal(invalidId.status, 400);
});

test('returns private my page activity only to the matching authenticated user', async () => {
  const headers = { authorization: 'Bearer mock-access-token' };
  const response = await fetch(`${apiUrl}/common/mypage/${userId}`, { headers });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.profile.major, '컴퓨터공학');
  assert.equal(payload.createdBoards[0].eventName, '대덕 해커톤');
  assert.equal(payload.appliedBoards[0].status, 'accepted');
  assert.equal(payload.appliedBoards[0].statusLabel, '합격');
  assert.equal('email' in payload.profile, false);
  assert.equal(lastBoardQuery.get('owner_id'), `eq.${userId}`);
  assert.equal(lastApplicationQuery.get('applicant_id'), `eq.${userId}`);

  const foreignPage = await fetch(`${apiUrl}/common/mypage/22222222-2222-4222-8222-222222222222`, { headers });
  assert.equal(foreignPage.status, 403);
  assert.equal((await fetch(`${apiUrl}/common/mypage/${userId}`)).status, 401);
});

test('protects record routes and only changes profile fields', async () => {
  assert.equal((await fetch(`${apiUrl}/common/record`)).status, 401);
  const headers = { authorization: 'Bearer mock-access-token' };
  const record = await fetch(`${apiUrl}/common/record`, { headers });
  assert.equal(record.status, 200);
  assert.deepEqual(await record.json(), { record: { major: '컴퓨터공학', awards: '해커톤 우수상' } });

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

