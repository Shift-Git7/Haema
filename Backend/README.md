# Haema Backend (Auth and profile)

Node.js + Express backend for Haema. Supabase Auth handles account creation, email confirmation, password sign-in, and access tokens. This first backend slice covers authentication, private profile/record endpoints, and account withdrawal; it does not implement board or application APIs.

## Requirements

- Node.js 20+
- A Supabase project
- School email addresses ending in `dsm.hs.kr`

## Supabase setup

1. Create a project in Supabase and save its database password.
2. In Project Settings > API, copy the Project URL and the publishable key (or legacy anon key). Put them in `.env` as `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
3. Copy `.env.example` to `.env`. Keep `SUPABASE_SERVICE_ROLE_KEY` empty until enabling account withdrawal. If used, this secret must stay on the backend and must never be sent to the frontend.
4. In Authentication settings, enable email signups and turn on **Confirm email**.
5. In Authentication > URL Configuration, configure the frontend Site URL and allowed Redirect URLs. If using a custom confirmation destination, set `EMAIL_REDIRECT_URL` to that URL and allow it in Supabase.
6. Open SQL Editor and run `supabase/migrations/202611240001_create_profiles.sql`.
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
- A recruiting post's contact method is separate from the signup email. The future board API should store and expose a post contact field only when the poster explicitly enters it.
- API database operations for records use the caller's bearer token so Supabase RLS is applied.

## ORM choice

This backend does not use Sequelize. Supabase Auth and `supabase-js` cover the current auth/profile scope with less connection and authorization setup. If the project later needs complex relational queries, an ORM can be added then; for Supabase, evaluate Prisma alongside Sequelize and keep RLS/ownership checks explicit.
