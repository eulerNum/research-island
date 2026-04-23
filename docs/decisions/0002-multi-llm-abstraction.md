# 0002. Multi-LLM Abstraction with Feature Slots

- **상태**: Accepted (Anthropic tool use 미구현 — Phase B에서 완성 검토)
- **날짜**: 2026-04-04 구현, ADR화: 2026-04-23 (Phase A)
- **Phase**: 사전 결정 (Phase A에서 흡수)

## 맥락

채팅(Gemini), 논문 요약(Gemini), 갭 분석(Gemini), Deep Search rerank(Gemini)가 모두 같은 provider를 쓰지만, 각각이 직접 Gemini API를 호출하고 있었다. 이후 (a) 정밀 판정용 OpenAI 추가, (b) 사용자가 모델을 바꿀 수 있는 UI, (c) 미래 Anthropic 추가를 고려하면 호출 코드가 4~5곳에 흩어져 변경 비용이 곱셈으로 늘어날 위험이 있었다.

또한 사용자 메모리 `feedback_pushback.md`에 "비용에 민감, 무료 티어 우선" 원칙이 있어 모델 선택 자유도가 비용 최적화의 핵심 수단이었다.

## 검토한 선택지

| 선택지 | 장점 | 단점 |
|--------|------|------|
| A. provider별 직접 호출 유지 | 변경 없음 | 호출 코드 흩어짐, 모델 변경 시 grep 의존 |
| B. provider facade 클래스 (각 호출마다 provider 인자) | 단일 진입점 | 호출자가 매번 provider/모델 선택 책임 — 정책이 분산 |
| C. **feature slot 추상화** (호출자는 slot만 지정, 모델 선택은 설정) | 호출자는 의도(`chat`/`deepSearch`/`summary`)만 알면 됨, 사용자 설정으로 모델 변경 | 슬롯 정의가 도메인 의존 — 새 의도 추가 시 슬롯 신설 |

## 결정

**C — feature slot 추상화**. `src/services/llmService.ts`가 단일 진입점. 호출자는 슬롯만 지정하고 모델은 설정에서 정해진다.

```ts
// 진입점
llmGenerate(feature, messages, options?): Promise<string>
llmGenerateJSON<T>(feature, messages): Promise<T>
llmChatWithTools(feature, messages, systemPrompt, tools): Promise<LLMToolResponse>
buildToolResultMessage(provider, results)  // provider-native 포맷 변환
```

| Slot | 용도 | 호출처 |
|------|------|--------|
| `chat` | 채팅 + tool use + 분류 | `aiChatService.ts` |
| `deepSearch` | JSON 생성 (갭 분석, rerank) | `deepSearchService.ts`, `gapAnalysisService.ts` |
| `summary` | 논문 요약 | `aiService.ts` |

설정 저장: `localStorage['ai-model-config']` JSON. 마이그레이션: 기존 `gemini-api-config` + `claude-api-config` → 자동 통합. UI: `src/components/AISettings.tsx` (3 키 + 3 슬롯 드롭다운).

지원 모델 (2026-04-04):

| provider | modelId | costTier |
|----------|---------|----------|
| gemini | gemini-2.5-flash-lite / flash / pro | free / free / moderate |
| openai | gpt-4o-mini / gpt-4o | cheap / moderate |
| anthropic | claude-haiku-4-5 / claude-sonnet-4-6 | cheap / expensive |

기본값: chat = Flash, deepSearch = Flash-Lite, summary = Flash.

## 시행착오

### 직접 호출 잔재 — 단일 진입점 강제 누락
초기 도입 시 `aiChatService.ts`만 `llmService` 통과로 옮기고 `aiService.ts`(요약)와 `gapAnalysisService.ts`(갭)는 그대로 둬서 모델 변경이 일부에만 적용되는 사고가 있었다. 해결: 모든 AI 호출을 `llmService` 통과로 강제, grep으로 직접 `geminiService` import 사용 검사.

### Tool use 응답 포맷의 provider-native 차이
Gemini는 `functionCall` 객체, OpenAI는 `tool_calls` 배열, Anthropic은 `content` 배열의 `tool_use` block. 단순 wrapping은 멀티턴(다음 턴에 messages로 다시 보낼 때) 깨짐. `LLMToolResponse.rawContent`에 provider-native 포맷을 그대로 보존하고 다음 턴 messages에 append하는 패턴으로 해결. `buildToolResultMessage(provider, results)`가 tool 결과를 provider-native로 다시 포장.

### Anthropic tool use는 시그니처만 두고 실구현 보류
`llmChatWithTools`의 Anthropic 분기는 함수 시그니처만 있고 실제 구현은 비어있다. 사용자가 chat 슬롯에 Anthropic을 선택하면 동작 안 함. 의도적 보류 — chat은 무료 티어 유지 정책상 Gemini로 충분, Anthropic은 향후 정밀 판정(deepSearch 슬롯)용으로 추가 검토. Phase B 또는 별도 ADR에서 결정.

### 마이그레이션 silent 실패 가능성
`gemini-api-config` + `claude-api-config` → `ai-model-config` 통합 마이그레이션이 silent fail이면 사용자가 키를 다시 입력해야 한다. 현재는 첫 호출 시 마이그레이션 시도 + 실패 시 빈 설정으로 폴백 → 사용자가 AISettings 열면 빈 칸으로 보임. 명시적 알림 미구현.

## 결과

- **모델 변경이 1곳**: 설정 UI에서 슬롯별 모델 변경 시 모든 호출에 즉시 반영
- **새 provider 추가 비용 ↓**: `llmService.ts` 한 파일 + `AVAILABLE_MODELS` 상수 + AISettings 옵션만 변경
- **비용 최적화 가능**: deepSearch는 Flash-Lite, chat은 Flash, 정밀 판정은 향후 GPT-4o-mini로 분기 가능
- **잔여 작업**: Anthropic tool use 구현, 마이그레이션 명시적 알림, fallback provider(1차 실패 시 2차 자동 재시도)
- **잠재 영향**: Skill 후보 `multi-llm-routing` (researcher craft-pack) — 2번째 프로젝트가 동일 슬롯을 채택하면 승격 검토
