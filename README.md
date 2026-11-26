# 해마 프론트엔드

React로 만든 화면을 로컬 브라우저에서 보며 수정할 수 있습니다.

## 실행

처음 한 번:

```bash
npm install
```

개발 서버 실행:

```bash
npm run dev
```

터미널에 나온 주소(보통 `http://localhost:5173`)를 브라우저에서 열어 주세요. `src/`의 코드를 저장하면 화면이 자동으로 새로고침됩니다. 이 프론트 화면만 확인할 때는 백엔드 서버를 켤 필요가 없습니다.

## 폴더 구조

```text
public/images/            로고와 이미지. 로고 파일명은 logo.svg
src/
  components/             헤더, 푸터, 공고 카드, 상세 창, 지원 창
  data/recruitments.js    화면에 표시하는 예시 공고
  App.jsx                 화면 전환과 페이지 조립
  main.jsx                React 화면 시작점
  styles.css              디자인과 반응형 화면
index.html                브라우저 페이지 시작 문서
vite.config.js            JSX 변환과 로컬 미리보기 설정
```

## 화면 수정

- 화면 동작과 페이지: `src/App.jsx`
- 작은 UI 부품: `src/components/`
- 색상, 간격, 모바일 화면: `src/styles.css`
- 예시 공고: `src/data/recruitments.js`
- 로고: `public/images/logo.svg`

공고·지원·프로필은 현재 브라우저 `localStorage`에 저장되는 프론트 시안입니다. 로그아웃은 브라우저에 저장된 로그인 토큰을 지우고 로그인 화면으로 이동합니다. 회원 탈퇴는 로그인 토큰이 있으면 백엔드의 `DELETE /common/account`를 호출하며, 미리보기 계정이면 로컬 공고·지원 내역만 지웁니다. 로그인 화면은 아직 데모라 실제 인증 연결은 별도 작업입니다.

API 주소는 기본값으로 `http://localhost:3000`을 사용합니다. 필요하면 `.env.example`을 `.env`로 복사해 `VITE_API_BASE_URL` 값을 바꾸세요. 백엔드 실행 시 CORS에서 프론트 주소 `http://localhost:5173`을 허용해야 합니다.
