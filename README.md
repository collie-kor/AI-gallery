# AI 이미지 갤러리 (Supabase 백엔드 · 멀티페이지)

사용자가 AI 생성 이미지를 업로드·관리하고, 모두가 갤러리에서 둘러보는 공유 플랫폼입니다.
로그인은 **Google 소셜 로그인 + 이메일/비밀번호**를 지원합니다.

- **Frontend**: HTML / CSS / Vanilla JS (멀티페이지)
- **Backend**: Supabase (Auth · PostgreSQL · Storage)
- **광고**: Google AdSense (헤더 · 사이드바 · 푸터 · 상세보기) — 코드에 `AdSense` 주석으로 표시

## 페이지 구조

| 페이지 | 설명 |
|--------|------|
| `index.html` | 로그인 / 회원가입 |
| `gallery.html` | 전체 갤러리 + 카테고리 필터 + 상세 모달 |
| `upload.html` | 이미지 업로드 (로그인 필요) |
| `profile.html` | 내 프로필 + 내가 올린 사진 관리(삭제) (로그인 필요) |

## 파일 구성

| 파일 | 역할 |
|------|------|
| `config.js` | Supabase URL/Key, 카테고리, AdSense 설정 |
| `auth.js` | Supabase 클라이언트 + 인증(로그인/가입/로그아웃/Google) |
| `app.js` | 공통 로직 (헤더·내비, 광고, 상세 모달, 셀렉트 채우기, 유틸) |
| `gallery.js` | 갤러리 + 제목 검색(ilike) + 2단계 필터(AI→카테고리) |
| `upload.js` | 업로드 (AI 툴 드롭다운 + Storage 업로드 → DB insert) |
| `profile.js` | 마이페이지 (내 사진 목록 / 편집 / 삭제) |
| `styles.css` | 전체 스타일 (밝은 팔레트, 반응형, 애니메이션) |
| `supabase-setup.sql` | DB 스키마 · RLS · 트리거 · Storage 정책 |
| `.env` / `.env.example` | 값 기록용 (브라우저 JS는 .env를 직접 못 읽으므로 config.js에 반영) |

> **환경변수 안내**: 순수 브라우저 Vanilla JS는 빌드 도구 없이 `.env`를 읽을 수 없습니다.
> 그래서 실제 값은 `config.js`에 두고, `.env`는 값의 출처(기록용)로 함께 보관합니다.

---

## 설정 순서

### 1. DB / Storage
신규 설치라면 SQL Editor에서 `supabase-setup.sql` 전체를 실행하세요. (idempotent)

⚠️ **기존 DB를 쓰던 경우 — 반드시 마이그레이션 1회 실행:**
`category` 컬럼이 단일 텍스트 → **배열(`text[]`)** 로 바뀌었습니다.
SQL Editor에서 `migration-category-array.sql` 를 한 번 실행하세요. (기존 단일 카테고리는 1개짜리 배열로 자동 변환)

카테고리·AI 툴 목록은 `config.js`의 `CATEGORIES` / `AI_TOOL_GROUPS` 한 곳에서 관리되며,
업로드·필터·편집이 모두 이를 공유합니다.

### 2. 인증 설정
- **Authentication → Providers → Google**: Client ID / Secret 입력 후 활성화 (이미 완료)
- **Authentication → URL Configuration**:
  - Site URL: 접속 주소 (예: `http://localhost:3000`)
  - Redirect URLs: `http://localhost:3000/**` (와일드카드로 모든 페이지 허용)

### 3. config.js
`SUPABASE_URL`, `SUPABASE_ANON_KEY` 입력 (완료된 상태).

### 4. 로컬 실행
OAuth는 `file://`에서 동작하지 않으므로 **로컬 서버**로 실행하세요.
```bash
npx serve .
# 또는 VS Code "Live Server"
```
첫 화면(`index.html`)에서 로그인 → 갤러리로 이동합니다.

---

## Google AdSense (선택)
1. 각 HTML `<head>`의 AdSense 로더 `<script>` 주석을 해제하고 `ca-pub-XXXX`를 본인 ID로 교체
2. `config.js`의 `ADSENSE.CLIENT` 및 `SLOTS` 채우기

설정 전에는 각 광고 위치에 "광고 영역" 자리표시 박스가 표시됩니다.
로더는 `async`라 페이지 렌더링을 막지 않습니다.

---

## 보안 (Supabase 베스트 프랙티스)
- 프론트엔드엔 **anon 키만** 사용 (service_role 금지)
- 모든 테이블 **RLS 활성화** — 조회는 공개, 작성/수정/삭제는 본인만 (`auth.uid()`)
- Storage는 `<user_id>/` 폴더 단위 쓰기 제한, 읽기 공개
- 가입 시 프로필 자동 생성, `updated_at` 자동 갱신 (트리거)
