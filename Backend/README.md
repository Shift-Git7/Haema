# Haema Backend (Auth and profile)

Node.js + Express backend for Haema. Supabase Auth handles account creation, email confirmation, password sign-in, and access tokens. This backend covers authentication, private profile/record endpoints, public board reads, and account withdrawal. Board creation and application submission are not implemented yet.

## Requirements

- Node.js 20+
- A Supabase project
- School email addresses ending in `dsm.hs.kr`

## Supabase setup

1. Create a project in Supabase and save its database password.
2. In Project Settings > API, copy the Project URL and the publishable key (or legacy anon key). Put them in `.env` as `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
3. Copy `.env.example` to `.env` and set `SUPABASE_SERVICE_ROLE_KEY`. Board reads and My Page activity queries use this server-only secret; never send it to the frontend.
4. In Authentication settings, enable email signups and turn on **Confirm email**.
5. In Authentication > URL Configuration, configure the frontend Site URL and allowed Redirect URLs. If using a custom confirmation destination, set `EMAIL_REDIRECT_URL` to that URL and allow it in Supabase.
6. Open SQL Editor and run both files in `supabase/migrations` in timestamp order.
7. For real user delivery, configure custom SMTP in Supabase Auth. Built-in email delivery may be rate-limited.
8. Install and run:

```powershell
npm install
npm run dev
```

The API listens at `http://localhost:3000`. Set `CORS_ORIGINS` to the exact frontend origins.

## API routes

### Sign up — `POST /common/sign-up`

```json
{
  "email": "student@dsm.hs.kr",
  "password": "Example!234",
  "passwordConfirm": "Example!234",
  "major": "컴퓨터공학",
  "awards": "교내 해커톤 우수상"
}
```

`major` and `awards` are optional strings (each up to 5,000 characters) and default to an empty string. Password must be at least 10 characters and contain an English uppercase letter, lowercase letter, digit, and one of `!@#$%^&*`. Password confirmation is checked and never stored. Only `dsm.hs.kr` or a subdomain ending in `.dsm.hs.kr` is accepted. Successful signup sends a confirmation email and does not issue a token until the user confirms the email.

### Log in — `POST /common/log-in`

```json
{
  "email": "student@dsm.hs.kr",
  "password": "Example!234"
}
```

Returns the access token, its expiry time, and the signed-in user's UUID. It does not return a refresh token. When the access token expires, the user must log in again.

### Read own my page — `GET /common/mypage/:id`

Send `Authorization: Bearer <accessToken>`. The `id` is the Supabase user UUID used for lookup and must match the token owner. The response omits the signup email.

### Read own record — `GET /common/record`

Returns the signed-in user's `major` and `awards` strings. Requires the bearer token.

### Edit own record — `PATCH /common/record/:id`

The `id` must match the token owner. Body may contain `major`, `awards`, or both. No account email or password update route is provided.

### Withdraw — `DELETE /common/account`

Requires the bearer token and `SUPABASE_SERVICE_ROLE_KEY`. Deletes the signed-in Supabase Auth user; the profile row is deleted by its foreign-key cascade. Deleted accounts may sign up again with the same school email. A previously issued stateless access token can remain valid until its expiry, so keep the Supabase JWT lifetime appropriately short.

## Privacy and authorization

- Signup email is stored by Supabase Auth and is not returned by profile endpoints.
- Public profiles are not enabled. Row Level Security limits profile reads and updates to the authenticated owner.
- A recruiting post's contact method is separate from the signup email. Board responses expose only the contact email entered in that post and omit the author ID and signup email.
- API database operations for records use the caller's bearer token so Supabase RLS is applied.

## ORM choice

This backend does not use Sequelize. Supabase Auth and `supabase-js` cover the current auth/profile scope with less connection and authorization setup. If the project later needs complex relational queries, an ORM can be added then; for Supabase, evaluate Prisma alongside Sequelize and keep RLS/ownership checks explicit.

## Public board read APIs

- `GET /common/board?limit=20&offset=0`: returns the newest boards first. `limit` defaults to 20 and must be 1–100; `offset` defaults to 0. It is public so visitors can browse before logging in.
- `GET /common/board/:id`: returns a single public board or 404. The response includes event name, deadline, original event URL, post title, recruiting content, headcount, and the contact email entered in the post. It does not include the author's user ID or signup email. No comment data is returned.

## My Page activity response

`GET /common/mypage/:id` now returns `profile`, `createdBoards`, and `appliedBoards`. The requested ID must match the verified access-token user. Each applied board includes the application status (`pending`, `accepted`, or `rejected`) and its Korean display label. Lists are empty until board and application records exist.

The board/application migration creates read models for these lists. Board creation and application submission APIs are outside this implementation scope.
