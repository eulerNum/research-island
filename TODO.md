# TODO

> 3단계 구조: **Phase**(`##`, 뿌리) → **Step**(`###`, 줄기) → **Task**(`- [ ]`, 나뭇잎)
>
> 규칙:
> - 대기 Phase는 **뿌리만** — Step/Task 미리 전개 금지 (점진적 계획)
> - 진행 중인 Phase만 Step + Task 전개 + 담당 agent 명시
> - 완료된 Phase는 `~~Phase N: 제목~~ ✅`만 남기고 Step/Task 접기 — 상세는 git history + `docs/plans/` + ADR
> - 새 PLAN 파일 만들지 않음 — 이 파일에서 직접 관리
>
> 본 TODO는 plan `~/.claude/plans/wild-foraging-music.md`(2026-04-23 승인)에서 도출.

## ~~Phase 0: 프로젝트 부트스트랩~~ ✅
<!-- 이 프로젝트는 /init-project 대신 자연 발생한 자산으로 부트스트랩됨. CLAUDE.md, HANDOFF.md, storage-flow.md, 8개 메모리 파일이 사실상 Phase 0 산출물. Phase A에서 거버넌스 표준화. -->

## Phase A: 거버넌스 정렬 + craft-pack 즉시 승격
Status: 진행 중

<!-- 자유 메모: 코드 변경 없는 거버넌스/문서/세팅. dev-agent 없이 메인에서 직접. -->
<!-- 특화 skill 후보 (가설): 없음 — 글로벌 자산만 다룸 -->
<!-- 모듈 CLAUDE.md 후보 (가설): src/services/CLAUDE.md (멀티프로바이더 LLM + 학술 API + storage 동기화 구조 설명용) — Phase B 진입 전 작성 검토 -->

### Requirements
- **범위**: TODO.md 표준화, ADR 3개, lint hook, Vitest 골조, craft-pack templates 2개 즉시 승격, pack.md 이력 갱신, MEMORY.md 갱신
- **성공기준**: `/interview`/`/phase`/`/quick`이 정상 호출 가능, ADR 3개가 storage-flow.md/HANDOFF.md/AI 메모리에 산재한 결정을 흡수, craft-pack templates를 Research-Ottugi 쪽에서도 참조 가능
- **제약**: 코드 동작 변경 금지(거버넌스만), 기존 HANDOFF.md/storage-flow.md는 유지(legacy reference로)
- **우선순위**: A-1(거버넌스) → A-2(craft-pack 승격) → A-3(검증/ship). 모두 의존성 적어 병렬
- **의존성**: 글로벌 `~/.claude/universal/{todo-template,adr-template,settings-policy}.md` 형식 준수
- **UX**: 사용자가 `/phase B`로 다음 단계 진입 시 TODO.md만 읽으면 컨텍스트 복원 가능해야 함

### Step A-1: 거버넌스 자산 (담당: 메인)
- [x] TODO.md 신설 (이 파일)
- [x] `docs/decisions/` 디렉토리 + ADR 0001-deep-search-architecture.md
- [x] ADR 0002-multi-llm-abstraction.md
- [x] ADR 0003-storage-indexeddb-github.md
- [ ] Vitest + `vitest.config.ts` + `src/services/__tests__/smoke.test.ts` 1개
- [ ] ~~`.claude/settings.local.json` lint hook~~ → **Phase B로 이관**: PreToolUse + git commit 분기 + block JSON 출력의 정확한 schema 검증 + PowerShell wrapper script 작성이 별도 작업. Phase B 안정성 step에 묶음.

### Step A-2: craft-pack 승격 (보류 결정, 2026-04-24)
- [~] ~~`~/.claude/craft-packs/researcher/templates/research-ontology.md` 신설~~ → **보류**
- [~] ~~`~/.claude/craft-packs/researcher/templates/paper-summary-format.md` 신설~~ → **보류**
- [~] ~~`~/.claude/craft-packs/researcher/pack.md` 승격 이력 갱신~~ → **보류**
- [x] `CLAUDE.md`에 craft-pack 참조 한 줄 추가 (`## Craft` 섹션) — 기존 researcher pack 참조이므로 유지

> 보류 사유: 사용자 1인 + 본 세션(Claude Code Opus 4.7 1M context)에서 직접 작업하는 환경에서는 craft-pack templates를 글로벌로 끌어올릴 실익이 적음. 다중 사용자 / Anthropic Console / API 자동화 등 다른 환경에서 craft-pack을 재참조해야 할 시점에 재추진. 본 프로젝트의 ontology/요약 schema 지식은 (a) `src/services/types.ts` (b) `docs/decisions/` (c) 본 프로젝트 메모리에 충분히 보존되어 있음.

### Step A-3: 검증 + 메모리 동기화 (담당: 메인)
- [ ] `npm run build` + `npm run lint` + `npx vitest run` 모두 통과 확인
- [ ] MEMORY.md 인덱스에 신규 ADR/TODO 참조 행 추가
- [ ] commit (`docs(governance): Phase A — TODO/ADR/lint hook/vitest 도입 + craft-pack 2개 승격`)
- [ ] push/merge는 사용자 확인

## Phase B: 코드 안정성 (Top 5 우려 처리)
Status: 대기

<!-- 자유 메모: Deep Search Phase 6, S2 rate limit, GitHub SHA 충돌, dedup 보강, aiSummary marked+DOMPurify. interview 시 묶는 단위 결정. -->
<!-- 특화 skill 후보 (가설): rate-limit-throttle (S2/PubMed 공통 토큰 풀이라면 services 횡단 skill 가능성) -->
<!-- 모듈 CLAUDE.md 후보 (가설): src/services/CLAUDE.md (Phase 6 + rate limit + dedup 정책 모음) -->

## Phase C: 외부 연동 — Insight Schema (Research-Ottugi 브릿지)
Status: 대기

<!-- 자유 메모: researcher craft-pack templates/insight-schema.md 신설 → src/services/exportInsight.ts → Ottugi 쪽 import. 본 프로젝트는 export까지만 범위. -->
<!-- 특화 skill 후보 (가설): insight-export (Schema 안정화 후 Skill로 승격 검토) -->

## Phase D: Craft pack 추가 승격 검증
Status: 대기

<!-- 자유 메모: Insight Schema가 Ottugi에서 import 성공 → templates/insight-schema.md 정식 승격. Skill 후보 4개(paper-search-multisource / deep-search-pipeline / multi-llm-routing / ai-chat-tool-use)는 2번째 프로젝트 검증 후. -->

## Phase E: Tech pack (보류)
Status: 보류

<!-- 자유 메모: web-react-vite tech-pack은 2번째 Vite 프로젝트가 생길 때까지 신설 보류. 그동안 본 프로젝트 로컬에 후보 자산 표시만 (premature abstraction 방지, feedback_promotion_rules.md 일치). -->

---

## 사용자 노트

> 사용자가 자유롭게 적는 영역. /interview, /phase 설계 시 반드시 읽고 반영.

- (비어있음 — 새 아이디어/우려/방향 추가 시 여기에)
