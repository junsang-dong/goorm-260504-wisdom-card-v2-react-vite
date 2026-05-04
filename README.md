# 명언 카드 (React + Vite)

한국 태생 유명인의 **명언**을 카드 형태로 보여 주는 웹앱입니다. GPT(OpenAI)가 카드 JSON을 생성하고, 명언 분위기에 맞는 **배경 이미지**를 골라 표시합니다. API 키는 브라우저가 아닌 **서버 측**에서만 사용합니다(로컬: Express, [Vercel](https://vercel.com/) 배포: `api/` Serverless Functions).

**원격 저장소:** [github.com/junsang-dong/goorm-260504-wisdom-card-v2-react-vite](https://github.com/junsang-dong/goorm-260504-wisdom-card-v2-react-vite)

```bash
git clone https://github.com/junsang-dong/goorm-260504-wisdom-card-v2-react-vite.git
cd goorm-260504-wisdom-card-v2-react-vite
```

---

## 프로젝트 개요

| 항목 | 설명 |
| --- | --- |
| **목적** | 유명인 한 줄 명언을 카드 UI로 감상하고, 한글·영문·인물 정보를 한 화면에서 확인 |
| **데이터** | `POST /api/wisdom-card` → OpenAI Chat Completions(JSON 모드)로 `quoteKo`, `quoteEn`, `personName`, `achievements`, `birthYear`, `deathYear`, `backgroundKey` 수신 |
| **음성(TTS)** | 헤더 **읽기** → `POST /api/speech` → OpenAI [`audio/speech`](https://platform.openai.com/docs/api-reference/audio/createSpeech)로 MP3 생성 후 브라우저 재생(한글 명언 + 영문). 재생 중 같은 버튼으로 **중지**. |
| **배경** | `backgroundKey`가 `green` / `blue` / `red` 중 하나로 정규화되며, [`public/backgrounds/`](public/backgrounds/)의 대응 이미지를 카드 배경으로 사용 (원본: [`REF_IMG_DOC/`](REF_IMG_DOC/)) |
| **UI** | 상단 **헤더 바**(제목 + 찜·공유·**읽기(TTS)** + 스피커 아이콘), **3장 캐러셀**(가운데 카드 중심·옆 카드 일부 노출), **다른 명언**으로 세 장 일괄 갱신, 하단 안내 문구 |

---

## 주요 기능

- **명언 카드**: 한국어 명언(상단·중앙 정렬) → 영문 번역 → 구분선 → 작성자 이름·생몰년·업적(좌측 정렬).
- **3장 캐러셀**: 한 번에 OpenAI를 **3회** 호출해 서로 다른 카드 3장을 채움. 슬라이드 클릭 또는 **← / →** 키로 가운데 카드 전환.
- **음성 읽기**: 가운데 카드 기준 `quoteKo`·`quoteEn`을 서버가 합쳐 TTS 요청. `gpt-4o-mini-tts`일 때만 `instructions`로 한·영 톤을 지정(`tts-1` 등은 미지원).
- **API 프록시(개발)**: Vite가 `/api`를 `http://127.0.0.1:8787`(기본)으로 넘겨, 클라이언트에 `OPENAI_API_KEY`가 노출되지 않음.
- **개발 서버 포트**: Vite **5153** 고정(`strictPort: true`). 주소: **http://localhost:5153/**

---

## 기술 스택

- **프론트**: React 19, TypeScript, Vite 8, CSS Modules (`WisdomCard`, `QuoteCarousel` 등)
- **백엔드**: Node.js + Express 5(로컬 `server/index.mjs`) / 동일 로직을 [`server/api-handlers.mjs`](server/api-handlers.mjs)에서 Vercel [`api/*.mjs`](api/)로 재사용
- **배포**: [Vercel](https://vercel.com/) — [`vercel.json`](vercel.json)으로 `dist` 정적 호스팅 + `/api/*` 함수
- **동시 실행(로컬)**: `concurrently`로 `node server/index.mjs` + `vite`

---

## 디렉터리 구조 (요약)

| 경로 | 역할 |
| --- | --- |
| [`src/App.tsx`](src/App.tsx) | 레이아웃, 헤더, TTS 재생, 캐러셀, 3건 병렬 fetch |
| [`src/App.css`](src/App.css) | 전역 앱·헤더·TTS 버튼 스타일 |
| [`src/components/WisdomCard.tsx`](src/components/WisdomCard.tsx) | 단일 명언 카드 UI |
| [`src/components/QuoteCarousel.tsx`](src/components/QuoteCarousel.tsx) | 3장 트랙·가운데 정렬·키보드 탐색 |
| [`src/lib/backgrounds.ts`](src/lib/backgrounds.ts) | `backgroundKey` → 정적 이미지 URL |
| [`server/api-handlers.mjs`](server/api-handlers.mjs) | OpenAI 호출·JSON/TTS 응답 (Express·Vercel 공용) |
| [`server/index.mjs`](server/index.mjs) | 로컬 Express 라우팅·`listen` |
| [`api/health.mjs`](api/health.mjs), [`api/wisdom-card.mjs`](api/wisdom-card.mjs), [`api/speech.mjs`](api/speech.mjs) | Vercel Serverless 엔드포인트 |
| [`vercel.json`](vercel.json) | 빌드 출력 `dist`, SPA 리라이트, 함수 `maxDuration` |
| [`vite.config.ts`](vite.config.ts) | `server.port` 5153, 개발용 `/api` 프록시 |

---

## 요구 사항

- Node.js **20** 이상 권장
- [OpenAI API 키](https://platform.openai.com/api-keys)

---

## 환경 변수

루트에 `.env`를 두고 [`.env.example`](.env.example)을 참고합니다. **`.env`는 Git에 올리지 마세요** (`.gitignore`에 포함됨).

| 변수 | 필수 | 설명 |
| --- | --- | --- |
| `OPENAI_API_KEY` | 예 | 서버 전용. `VITE_` 접두사 금지 |
| `OPENAI_MODEL` | 아니오 | 기본 `gpt-4o-mini` |
| `OPENAI_SPEECH_MODEL` | 아니오 | TTS 기본 `gpt-4o-mini-tts` |
| `OPENAI_SPEECH_VOICE` | 아니오 | 기본 `coral`([내장 보이스](https://platform.openai.com/docs/guides/text-to-speech)) |
| `API_PORT` | 아니오 | API 기본 `8787` |
| `VITE_API_PROXY_TARGET` | 아니오 | Vite 프록시 대상 URL (기본 `http://127.0.0.1:8787`) |

**Vercel:** 위 변수를 [Project → Settings → Environment Variables](https://vercel.com/docs/projects/environment-variables)에 동일한 이름으로 등록합니다(Production / Preview 필요 시). `VITE_*` 접두사는 사용하지 않습니다.

---

## Vercel 배포

1. [Vercel](https://vercel.com/)에 로그인 후 **Add New… → Project**에서 GitHub 저장소 `goorm-260504-wisdom-card-v2-react-vite`를 연결합니다.
2. Framework는 자동 감지되며, 루트의 [`vercel.json`](vercel.json)이 `npm run build`와 출력 디렉터리 `dist`를 사용합니다.
3. **Environment Variables**에 `OPENAI_API_KEY`를 필수로 추가하고, 선택 변수(`OPENAI_MODEL`, `OPENAI_SPEECH_MODEL`, `OPENAI_SPEECH_VOICE`)를 로컬과 맞춥니다.
4. **Deploy** 후 발급된 URL(예: `https://….vercel.app`)로 접속합니다. 동일 오리진에서 `/api/wisdom-card` 등이 Serverless로 처리됩니다.
5. 배포 확인: 브라우저 또는 `curl`로 `GET https://<배포도메인>/api/health` → `{"ok":true}`.

로컬에서 Vercel 환경을 흉내 내려면 [Vercel CLI](https://vercel.com/docs/cli) `vercel dev`를 사용할 수 있습니다(별도 설치).

---

## 로컬 실행

```bash
npm install
cp .env.example .env   # 편집기로 OPENAI_API_KEY 입력
npm run dev
```

- 브라우저: **http://localhost:5153/**
- API만: `npm run dev:api`
- Vite만: `npm run dev:web` (이때도 `/api`를 쓰려면 API를 먼저 띄워야 함)

---

## 빌드 · 미리보기

```bash
npm run build
npm run preview
```

`preview`는 **정적 프론트만** 제공하며 `/api`는 연결되지 않습니다. **프로덕션**에서는 Vercel 등에 올릴 때 위 **Vercel 배포** 절차처럼 `api/` 함수와 `dist`를 함께 배포하면, 앱의 `fetch('/api/…')`가 그대로 동작합니다.

---

## npm 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | Express(API) + Vite 동시 실행 |
| `npm run build` | `tsc -b` 후 `vite build` |
| `npm run lint` | ESLint |

---

## 참고

- **토큰·비용**: 초기 로드와「다른 명언」마다 카드 **3장**을 요청하므로 Chat Completions는 **배치당 3회**입니다. **「읽기」**를 누를 때마다 Speech API가 **추가 1회** 호출됩니다.
- **배경 이미지**: Unsplash 출처 파일명을 유지한 JPG가 `public/backgrounds/`에 포함되어 있습니다.
- **Vercel 함수 시간**: [`vercel.json`](vercel.json)에서 `api/**/*.mjs`의 `maxDuration`은 **10초**(Hobby 등 기본 한도에 맞춤). OpenAI가 자주 타임아웃하면 플랜에 맞게 상향하세요.
