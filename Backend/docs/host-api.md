# 모집자 API

기존 회원 담당의 Supabase Auth와 `requireAuth`를 사용합니다. ORM 없이 Supabase JS 클라이언트로 조회하고, 정원 변경·지원 결정은 SQL 함수로 처리합니다.

## 실행 및 DB 적용

```bash
cd ~/Git-Repo/Haema/Backend
npm ci
cp .env.example .env
# .env에 실제 Supabase 설정을 입력한 다음
npm run dev
```

기존 `.env`가 있다면 복사 명령으로 덮어쓰지 말고 필요한 설정만 추가하세요.

- 새 Supabase 프로젝트: `supabase/migrations`의 세 SQL 파일을 파일명 순서대로 실행합니다.
- 기존 두 마이그레이션을 이미 적용한 프로젝트: `202611270001_host_management.sql`만 추가 실행합니다.
- 실제 Supabase 프로젝트에 마이그레이션을 원격 적용하지는 않았습니다.
- 모집자 API도 기존 게시판 조회와 동일하게 서버의 `SUPABASE_SERVICE_ROLE_KEY`가 필요합니다. 프런트엔드에 노출하면 안 됩니다.

## 인증과 응답

모든 요청에 `Authorization: Bearer <accessToken>`을 보냅니다. `/common/log-in`이 반환한 토큰을 사용합니다. 모집자 API는 이메일 미인증·익명 로그인 사용자를 차단합니다.

공고 작성자 ID는 검증된 토큰에서만 가져옵니다. 다른 작성자의 데이터와 존재하지 않는 데이터 모두 404를 반환합니다. 모집자와 지원자는 별도 회원 역할이 아닙니다.

공고 응답은 기존 공통 게시판과 동일한 camelCase입니다. 사용자 ID와 가입 이메일은 응답하지 않습니다. 연락 이메일은 공고에 별도로 작성한 값입니다.

| 메서드 | 경로 | 성공 응답 |
| --- | --- | --- |
| GET | `/host/board?limit=20&offset=0` | 200 `{ items: [...], pagination: { limit, offset } }` |
| POST | `/host/board` | 201 `{ board: {...} }` |
| GET | `/host/board/{공고 UUID}` | 200 `{ board: {...} }` |
| PATCH | `/host/board/{공고 UUID}` | 200 `{ board: {...} }` |
| DELETE | `/host/board/{공고 UUID}` | 204, 본문 없음 |
| GET | `/host/app/list?boardId={공고 UUID}&limit=20&offset=0` | 200 `{ items: [...], pagination: { limit, offset } }` |
| GET | `/host/app/{지원서 UUID}` | 200 `{ application: {...} }` |
| PATCH | `/host/app/{지원서 UUID}` | 200 `{ application: {...} }` |

목록은 `created_at DESC, id DESC` 정렬입니다. limit은 1~100(기본 20), offset은 0~100000(기본 0)입니다.

## 공고 작성·수정

작성은 아래 7개 필드가 모두 필요합니다. 수정은 수정할 필드만 보냅니다. 빈 객체, null, 알 수 없는 필드는 거부합니다.

```json
{
  "eventName": "대덕 해커톤",
  "deadline": "2026-12-20",
  "sourceUrl": "https://example.com/event",
  "title": "백엔드 팀원 모집",
  "recruitingContent": "Node.js 경험자를 모집합니다.",
  "recruitmentCount": 2,
  "contactEmail": "team@example.com"
}
```

- 대회명·제목: 각 1~200자
- 마감일: 실제 존재하는 `YYYY-MM-DD` 날짜. 마감일 경과 후 수정/결정을 막는 규칙은 현재 적용하지 않습니다.
- 대회 URL: HTTP(S), 최대 2048자, URL 내부 인증정보 불가
- 모집 내용: 1~10000자
- 모집 인원: 1~100 사이 정수. 작성자를 제외한 추가 모집 인원으로 정의합니다.
- 연락 이메일: 최대 254자

문자열 양끝 공백을 제거합니다. 응답 공고에는 위 필드와 `id`, `createdAt`, `updatedAt`이 포함됩니다. 생성 성공 시 `Location: /host/board/{id}`도 반환합니다.

공고 삭제 시 기존 외래키 규칙에 따라 지원서와 이메일 기록/미발송 대기열도 삭제됩니다.

## 지원서 조회·결정

지원서는 기존 스키마의 `content`만 사용합니다. 지원자 프로필이나 가입 이메일을 추가로 공개하지 않습니다.

```json
{
  "application": {
    "id": "30000000-0000-4000-8000-000000000001",
    "boardId": "20000000-0000-4000-8000-000000000001",
    "content": "백엔드로 지원합니다.",
    "status": "pending",
    "statusLabel": "검토 중",
    "createdAt": "2026-11-27T09:00:00+00:00",
    "updatedAt": "2026-11-27T09:00:00+00:00"
  }
}
```

수락·거절 요청 본문:

```json
{ "status": "accepted" }
```

- `accepted`: 합격, `rejected`: 탈락. `pending`은 검토 중입니다.
- 동일한 결정을 반복하면 기존 결과를 반환합니다. 최종 결정을 반대로 바꾸거나 검토 중으로 되돌릴 수 없습니다.
- 공고 행을 잠근 뒤 정원을 확인해 초과 수락과 수락 인원보다 작은 정원 변경을 막습니다.
- 작성자 자신의 지원서를 결정할 수 없습니다.
- 결과 저장과 이메일 대기열 등록은 하나의 트랜잭션입니다. 대기열 등록 실패 시 결정도 롤백됩니다.
- 지원서 제출·취소 API는 지원자 담당 범위입니다. 기존 `applications` 테이블과 상태값을 그대로 연결하면 됩니다.

## 이메일 worker

Supabase Auth의 회원가입 인증 메일과 별도로 SMTP를 사용합니다. `.env`에 `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`을 설정합니다. worker에도 `SUPABASE_SERVICE_ROLE_KEY`가 필요합니다.

```bash
npm run worker
```

최대 10개를 처리하고 종료합니다. 배포 환경에서는 cron 등으로 매분 실행하세요. API 서버 실행만으로 결과 메일이 발송되지는 않습니다.

수락·거절 결과 모두 발송하며 실패 시 최대 1시간 간격으로 재시도합니다. DB 임대 토큰과 `SKIP LOCKED`로 worker 간 중복 처리를 줄입니다. 발송 직후 프로세스가 종료되면 재발송될 수 있어 정확히 한 번 발송을 보장하지는 않습니다. 동일한 Message-ID를 재사용합니다.

실제 Supabase 연결·SMTP 실발송과 여러 DB 연결을 통한 동시 경쟁은 별도 운영 설정 후 확인해야 합니다. 테스트에서는 HTTP 클라이언트/인증 연결, 단일 PGlite 연결에서 SQL·권한·정원·롤백, 이메일 worker 동작을 확인합니다.

## 오류

모집자 API의 업무 오류는 `{ "error": "설명", "code": "코드" }` 형식입니다. 기존 인증 미들웨어·JSON 파서의 오류는 기존 `{ "error": "설명" }` 형식을 유지합니다.

- 400: 입력값/UUID/JSON 오류
- 401: 토큰 누락·무효
- 403: 이메일 미인증·권한 없음
- 404: 내 공고·지원서를 찾을 수 없음
- 409: 정원 초과·최종 결정 변경 등 상태 충돌
- 413: JSON 본문 32KB 초과
- 503: Supabase service-role 설정 누락·DB 처리 실패

## 검증

```bash
npm test
```

기존 회원 API 회귀 테스트, 모집자 라우트 테스트, 세 마이그레이션을 함께 적용하는 PostgreSQL(PGlite) 테스트, 이메일 worker 테스트가 포함됩니다. `.env`나 실제 외부 계정 없이 실행하며 로컬 테스트 포트를 사용할 수 있어야 합니다.
