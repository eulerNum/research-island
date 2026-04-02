# Handoff — Research Island Map

2026-04-02 기준 현황. 다음 에이전트는 이 파일만 읽고 이어갈 수 있음.

---

## 프로젝트 요약

연구를 **섬-다리-도시-도로** 메타포로 시각화하는 인터랙티브 웹앱.
Vercel 배포 + GitHub API 데이터 저장. AI 채팅으로 논문 탐색/추가/자동분류.

---

## Git 현황

- **브랜치**: `main`
- **GitHub remote**: `https://github.com/eulerNum/research-island.git`
- **Vercel 배포**: 완료 (push 시 자동 재배포)
- `npm run build` + `npm run lint` 통과 상태

---

## 최근 세션 (2026-04-01~02) 작업 내역

### 1. AI 채팅 기능 ✅
DetailPanel 상단에 접기/펼치기 채팅 UI. Gemini 2.5 Flash 기반.

- **파일**: `aiChatService.ts`, `useAIChat.ts`, `AIChatPanel.tsx`
- **Tool use**: `search_papers`, `add_paper`, `deep_search`, `summarize_paper`
- 논문 추가 시 Gemini가 다른 다리/도로에도 자동 분류
- 자유 대화 + 논문 탐색 + 요약 가능

### 2. Deep Search v2 — 7단계 파이프라인 ✅
`deepSearchService.ts` 전면 재작성.

| Phase | 이름 | 설명 |
|-------|------|------|
| 0 | Query Framing + Pseudo-seed | 시드 없어도 Gemini가 개념/동의어/분야 추출 → pseudo-seed |
| 1 | Citation Expansion | refs + cites (S2+OpenAlex) |
| 2 | Multi-query Retrieval | 정규화 쿼리 S2+OpenAlex+PubMed 병렬 |
| 3 | Recommendation + Venue Tracing | S2 추천 + 빈출 저널 추적 |
| 4 | Cheap Compression | 중복/연도/overlap/source cap/review cap + drop log |
| 5 | LLM Abstract Rerank | 4차원 점수 (topical/methodological/directApplicability/reviewValue) |
| 6 | Iterative Refinement | 편중 시 보완 쿼리 → 2차 검색 → 합산 rerank |

### 3. 학술 API 3소스 통합 ✅
- **Semantic Scholar**: search + refs/cites + recommendations + author papers
- **OpenAlex**: search + cited_by + venue search (무료, 10만건/일)
- **PubMed**: E-utilities esearch + esummary (무료)

### 4. 채팅 엔진 Claude → Gemini 전환 ✅
- `aiChatService.ts`: Claude API 의존성 완전 제거
- Gemini 2.5 Flash로 대화 + tool use + 요약 + 자동분류 모두 처리
- API 비용: **무료** (Gemini 무료 티어)

### 5. UI 개선 ✅
- AI Chat을 DetailPanel **상단**으로 이동 (펼치면 Papers/Gaps 숨김)
- DetailPanel **리사이즈 가능** (360~800px, 좌측 드래그 핸들)
- 시스템 프롬프트: 식품과학 한정 → **cross-disciplinary**로 변경

### 6. AI 설정 UI 확장 ✅
- `ClaudeSettings.tsx`: Claude + Gemini API key 동시 설정
- Google AI Studio 발급 링크 제공

---

## 이전 세션 작업 (누적)

- 논문 학습 패널 (PaperStudyPanel) ✅
- 사이드바 리디자인 (기본 펼침, 3분리 인터랙션) ✅
- 섬 조망도 인터랙션 (hover, 클릭 확장, 더블클릭 이동) ✅
- 갭 메모 포스트잇 애니메이션 ✅
- GitHub 동기화 (SHA 충돌감지, Blob API, CORS 해결) ✅
- 사이드바 → 다리/도로 논문 드래그&드롭 ✅
- 멀티맵 홈페이지 + PIN 잠금 ✅
- Undo/Redo, 컨텍스트 메뉴, 색상 팔레트 ✅
- 다크모드 ✅
- Vercel 배포 안정화 (ignoreCommand) ✅
- auto-save 제거 → 수동 Save + 자동 Load ✅

---

## 미구현 항목

### AI 기능 (향후)
- [ ] Top-k full-text reading (상위 논문 본문 접근 — PDF 파싱 필요)
- [ ] User feedback at branch points (결과 분기 시 유저 확인)
- [ ] GPT-5.4 mini 정밀 판정 (Gemini 평가 후 상위만 OpenAI로 재평가)
- [ ] Crossref API 추가 (4번째 학술 소스)
- [ ] MeSH 기반 PubMed 검색 (통제어 매핑)

### 기타
- [ ] 다리 라벨 체계 (`방법명 (주체)` 가이드 UI)
- [ ] 논문에 "관련 도시" 필드 (`relatedCityIds`)
- [ ] n8n 워크플로우 본격 연동
- [ ] 읽기 전용 공유 모드
- [ ] 맵 삭제/수정 기능

---

## 핵심 아키텍처 결정

1. **AI 엔진**: Gemini 2.5 Flash (무료) — 채팅 + 깊은 탐색 모두
2. **학술 API**: S2 + OpenAlex + PubMed (모두 무료, API key 불필요)
3. **Deep Search**: 계단식 7단계 (수집→압축→평가→반복)
4. **분야 제한 없음**: cross-disciplinary 시스템 프롬프트
5. **비용 구조**: 논문 수집 = 무료, AI 평가 = Gemini 무료 티어
6. **멀티맵 라우팅**: `/` → HomePage, `/map/:mapId/*` → MapWrapper
7. **GitHub sync**: 수동 Save + 탭 복귀 시 자동 Load + SHA 충돌 감지
8. **캐시 우회**: URL `?t=Date.now()` (NOT `cache: 'no-store'`)
9. **대용량 파일**: Git Blob API (NOT `raw.githubusercontent.com`)

---

## 알려진 이슈

### CORS / fetch 실패 교훈 (중요)
**절대 하지 말 것**:
- `cache: 'no-store'` → CORS 실패
- `If-None-Match` 헤더 → CORS preflight 실패
- `raw.githubusercontent.com` + `Authorization` → CORS 차단
- `btoa(unescape(encodeURIComponent(...)))` → 큰 JSON 깨짐

**올바른 방법**: URL `?t=timestamp`, `TextEncoder/TextDecoder`, Git Blob API

---

## 파일 구조

```
research-island-map/
├── CLAUDE.md                    빌드/아키텍처/컨벤션/디버깅 가이드
├── PLAN-AI.md                   AI 기능 구현 현황 + 미구현 목록
├── PLAN-SPEC.md                 상세 구현 계획서
├── PLAN-MANAGE.md               멀티맵 관리 시스템 설계서
├── HANDOFF.md                   이 파일
├── src/
│   ├── pages/
│   │   ├── HomePage.tsx         멀티맵 홈 + Settings
│   │   ├── MapWrapper.tsx       mapId별 MapDataContext
│   │   ├── OverviewPage.tsx     섬 조망도 + DetailPanel + PaperStudyPanel
│   │   └── IslandDetailPage.tsx 섬 내부 뷰
│   ├── components/
│   │   ├── IslandMap.tsx        D3 섬 + 다리
│   │   ├── CityMap.tsx          D3 도시 + 도로
│   │   ├── Sidebar.tsx          트리 네비 + 논문 그룹핑 + draggable
│   │   ├── DetailPanel.tsx      우측 패널 (리사이즈 가능 360~800px)
│   │   ├── AIChatPanel.tsx      AI 채팅 UI (Gemini tool use)
│   │   ├── PaperStudyPanel.tsx  논문 학습 공간
│   │   └── ...                  (GapMemo, PaperForm, Dialogs, Settings 등)
│   ├── hooks/
│   │   ├── useMapData.ts        CRUD + GitHub sync
│   │   ├── useAIChat.ts         AI 채팅 상태 관리
│   │   └── ...
│   ├── services/
│   │   ├── aiChatService.ts     Gemini 채팅 (tool use + 자동분류)
│   │   ├── deepSearchService.ts Deep Search v2 (7-phase)
│   │   ├── geminiService.ts     Gemini 2.5 Flash API
│   │   ├── openAlexService.ts   OpenAlex API (무료)
│   │   ├── pubmedService.ts     PubMed E-utilities (무료)
│   │   ├── semanticScholarService.ts S2 API (무료)
│   │   ├── aiService.ts         Claude API (legacy — suggestPapers)
│   │   ├── githubService.ts     GitHub Contents/Blob API
│   │   └── ...
│   └── utils/
└── data/                        GitHub API로 관리
```

---

## 유저 특성

- 한국어 소통 선호
- 식품과학(관능과학) 연구자 — 연구 분야: Samples, Flavors, Visual Elements, Images, Emotions
- 분야 간 교차 연구에 관심 (심리학, 신경과학, HCI, 마케팅 등)
- 불필요한 UI 싫어함
- 논문을 **학습 공간**으로 활용
- AI 통합에 적극적이지만 비용에 민감 → 무료 티어 우선
