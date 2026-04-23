# 0001. Deep Search Cascading Pipeline

- **상태**: Accepted (Phase 6 미구현 — Phase B에서 완성 예정)
- **날짜**: 2026-04-02 (HANDOFF.md 기준), ADR화: 2026-04-23 (Phase A)
- **Phase**: 사전 결정 (Phase A에서 흡수)

## 맥락

식품과학 cross-disciplinary 연구를 위한 논문 탐색 도구가 필요했다. 단일 키워드 검색은 (a) 인접 분야의 동의어를 놓치고, (b) 시드 논문 없이는 방향을 잡지 못하며, (c) 상위 수십 건 중 어느 것이 정말 관련 있는지 평가가 빠져 있었다.

추가 제약:
- 비용 0원 또는 무료 티어로 운영해야 함 (사용자 메모리 `feedback_pushback.md` — 비용 민감)
- 학술 API key 발급 의존성 최소화
- 채팅 UI에서 자연어로 호출 가능해야 함 (`aiChatService.ts`의 `deep_search` tool)

## 검토한 선택지

| 선택지 | 장점 | 단점 |
|--------|------|------|
| A. 단일 키워드 검색 (S2 단독) | 가장 단순, 빠름 | 인접 분야 누락, 평가 없음, 시드 없으면 무력 |
| B. RAG (논문 임베딩 → 벡터 검색) | 의미 검색 강함 | 임베딩 비용·인프라 필요, 무료 티어 부적합 |
| C. 계단식 다단계 파이프라인 (수집→압축→평가→반복) | 무료 API 조합으로 의미 검색에 근접, 단계별 디버깅 가능 | 단계 수만큼 복잡도 증가, 단계 간 책임 경계 설계 필요 |
| D. 외부 도구 위임 (Connected Papers 등) | 구현 0 | API 비공개·rate 제한·통합 불가 |

## 결정

**C — 계단식 7단계(Phase 0~6) 파이프라인**. 무료 학술 API 3종(Semantic Scholar, OpenAlex, PubMed) + 무료 LLM(Gemini Flash-Lite)으로 의미 검색에 근접.

| Phase | 책임 | 구현 위치 |
|-------|------|---------|
| 0. Query Framing + Pseudo-seed | LLM이 개념/동의어/분야 추출 (시드 없어도 동작) | `src/services/deepSearchService.ts` phase0 |
| 1. Citation Expansion | seed의 refs/cites 수집 (S2) | phase1 |
| 2. Multi-query Retrieval | 정규화 쿼리로 S2 + OpenAlex + PubMed 병렬 검색 | phase2 |
| 3. Recommendation + Venue Tracing | S2 추천 + 빈출 저널 추가 검색(OpenAlex) | phase3 |
| 4. Cheap Compression | dedup + 연도 필터 + overlap + source/review cap | phase4 |
| 5. LLM Abstract Rerank | 4차원 점수(topical/methodological/directApplicability/reviewValue) JSON 출력 | phase5, `llmGenerateJSON('deepSearch', ...)` |
| 6. Iterative Refinement | coverage gap 감지 → 보완 쿼리 → 부분 재실행 | **미구현 (주석만)** |

호출 진입점: `aiChatService.ts`의 `deep_search` tool → `deepSearchService.deepSearch(context)`. `DeepSearchContext`는 bridge label, seed papers, year filter 등을 담음.

## 시행착오

### 채팅 엔진 Claude → Gemini 전환
초기에는 Anthropic Claude로 채팅+요약을 모두 처리했다. tool use 응답 품질은 좋았으나 무료 티어가 없어 비용이 발생했다. Gemini 2.5 Flash가 (a) 무료 티어, (b) tool use 지원, (c) 충분한 한국어 품질을 보여 전환했다. `aiChatService.ts`에서 Anthropic 직접 호출을 제거하고 `llmService.ts`의 `chat` 슬롯에 Gemini Flash를 기본 모델로 박았다(ADR 0002 참조).

### 분야 제한 시스템 프롬프트 → cross-disciplinary
처음 시스템 프롬프트는 "식품과학 한정"이었다. 결과적으로 LLM이 인접 분야 인용을 의도적으로 배제해 깊은 탐색을 막았다. cross-disciplinary로 변경 후 추천 품질이 명확히 개선됐다. 메모리 `project_paper_features.md`의 "분야 제한 없음" 원칙이 여기서 도출됨.

### Phase 6의 미구현 — 의도된 미루기
Phase 6 Iterative Refinement는 설계 시 명시했으나 5단계까지 충분한 결과가 나왔고, "6단계까지 돌릴 시점에는 이미 사용자가 결과를 눈으로 골랐다"는 가설로 미뤘다. 실제 운영에서 이 가설이 무너지는 케이스(coverage gap이 명확한데도 멈추는 경우)가 누적돼, Phase B에서 구현하기로 plan에 등록됨.

### Rate limit 미제어
Phase 2가 S2/OpenAlex/PubMed를 `Promise.all`로 동시 호출한다. S2의 100req/5min 한도를 초과해 silent empty array가 반환되는 사고가 가능하다. 발생 빈도는 낮지만 처방 미적용 — Phase B에서 토큰 풀 + 지수 백오프 도입 예정.

## 결과

- **무료 운영 달성**: 학술 API 3개 + Gemini 무료 티어로 모든 검색·평가 0원
- **시드 없는 검색 가능**: Phase 0 pseudo-seed 덕에 채팅에서 자연어 1줄로 시작 가능
- **평가가 결과의 일부**: 사용자가 상위 N개에 시간을 쓸 가치가 있다고 판단할 근거(4차원 점수)가 같이 나옴
- **남은 작업**: Phase 6 구현, S2 rate limit 제어, dedup 보강(DOI 우선) → TODO.md Phase B
- **잠재 영향**: Phase B 완료 후 두 번째 프로젝트(Research-Ottugi 등)에서 동일 패턴 사용 시, `researcher/skills/deep-search-pipeline/`로 승격 검토 (현재 후보)
