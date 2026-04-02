# AI 기능 구현 계획

## 구현 완료 현황

### Part 1: AI 채팅 기능 ✅

| 파일 | 상태 |
|------|------|
| `src/services/aiChatService.ts` | ✅ Gemini API 기반 채팅 (tool use + 자동분류) |
| `src/hooks/useAIChat.ts` | ✅ 채팅 상태 관리 훅 |
| `src/components/AIChatPanel.tsx` | ✅ 접기/펼치기 채팅 UI (DetailPanel 상단 배치) |
| `src/components/DetailPanel.tsx` | ✅ AIChatPanel 통합 + 리사이즈 핸들 (360~800px) |
| `src/pages/OverviewPage.tsx` + `IslandDetailPage.tsx` | ✅ 새 props 전달 |

**사용법**: 다리/도로 클릭 → DetailPanel 상단 "AI Chat" 토글 → 대화 시작
**필요**: Gemini API key (무료)

### Part 2: 학술 API 연동 ✅

| 파일 | 상태 |
|------|------|
| `src/services/geminiService.ts` | ✅ Gemini 2.5 Flash 연동 (무료) |
| `src/services/openAlexService.ts` | ✅ OpenAlex 검색 + 인용 추적 + 저널 검색 (무료) |
| `src/services/pubmedService.ts` | ✅ PubMed E-utilities 검색 (무료) |
| `src/services/semanticScholarService.ts` | ✅ S2 검색 + refs/cites + 추천 + 저자 (무료) |
| `src/components/ClaudeSettings.tsx` | ✅ Claude + Gemini API key 입력 UI |

### Part 3: Deep Search v2 — 3층 구조 ✅

`src/services/deepSearchService.ts` 전면 재작성.

| Phase | 이름 | 상태 | 설명 |
|-------|------|------|------|
| 0 | Query Framing + Pseudo-seed | ✅ | 시드 없어도 Gemini가 개념/동의어/분야 추출 → pseudo-seed 선정 |
| 1 | Citation Expansion | ✅ | seed/pseudo-seed의 refs + cites (S2+OpenAlex) |
| 2 | Multi-query Retrieval | ✅ | 정규화 쿼리로 S2+OpenAlex+PubMed 병렬 |
| 3 | Recommendation + Venue Tracing | ✅ | S2 추천 + 빈출 저널 추적 (저자→저널로 변경) |
| 4 | Cheap Compression | ✅ | 중복/연도/overlap/source cap/review cap + drop log |
| 5 | LLM Abstract Rerank | ✅ | 4차원 점수 (topical/methodological/directApplicability/reviewValue) |
| 6 | Iterative Refinement | ✅ | 1차 결과 편중 시 보완 쿼리 → 2차 검색 → 합산 rerank |

**사용법**: AI Chat에서 "깊은 탐색해줘" 입력
**필요**: Gemini API key (무료, Google AI Studio에서 발급)

### Part 4: 미구현 (향후 과제)

| 우선순위 | 기능 | 상태 | 비고 |
|---------|------|------|------|
| 4순위 | Top-k full-text reading | ❌ | 상위 10~20편만 본문 접근. 브라우저 PDF 파싱(CORS+PDF.js) 필요 |
| 5순위 | User feedback at branch points | ❌ | 결과 분기 시 유저 확인. 자동화 우선이라 후순위 |
| - | GPT-5.4 mini 정밀 판정 | ❌ | Gemini 평가 후 상위만 OpenAI mini로 재평가 (유료) |
| - | Crossref API 추가 | ❌ | 4번째 학술 소스. 현재 3소스로 충분 |
| - | MeSH 기반 PubMed 검색 | ❌ | MeSH term 매핑 API 필요. 현재 키워드 검색으로 대체 |

## 아키텍처 결정 사항

- **채팅 엔진**: Claude API → **Gemini 2.5 Flash로 전환** (무료)
- **시스템 프롬프트**: 식품과학 한정 → **분야 무관 cross-disciplinary**로 변경
- **채팅 UI**: DetailPanel 하단 → **상단으로 이동**, 펼치면 Papers/Gaps 숨김
- **사이드바**: 고정 360px → **리사이즈 가능** (360~800px, 드래그 핸들)
- **비용 구조**: 논문 수집 = 무료 (S2+OpenAlex+PubMed), AI 평가 = Gemini 무료 티어

## 설정 방법

1. [Google AI Studio](https://aistudio.google.com/apikey)에서 Gemini API key 발급 (무료)
2. 다리/도로 클릭 → DetailPanel → AI Chat 에러의 "API 설정" 클릭
3. Gemini API Key 입력
4. (선택) Claude API Key 입력 — 기존 "AI 논문 제안" 버튼용
