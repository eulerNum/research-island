# 0003. Two-Tier Storage — IndexedDB Cache + GitHub as Source of Truth

- **상태**: Accepted (충돌 자동 머지 미구현 — Phase B로)
- **날짜**: 점진 결정 2026-03 ~ 2026-04, ADR화: 2026-04-23 (Phase A)
- **Phase**: 사전 결정 (Phase A에서 흡수)

## 맥락

초기에는 맵 데이터(섬·다리·도시·도로·논문·갭)를 `localStorage`에 JSON 통째로 저장했다. 사용자가 논문을 50~100건 추가하고 AI 요약·그림 URL이 누적되자 5MB 한도를 넘어 silent fail이 발생했다. 동시에 사용자는 다중 디바이스에서 같은 맵을 보고 싶어했다.

요구사항:
- **R1**: 5MB 이상 데이터 저장 가능
- **R2**: 다중 디바이스 동기화 (사용자 메모리 `project_github_sync_simplify.md`)
- **R3**: 인터넷 끊김에도 작업 가능 (오프라인 폴백)
- **R4**: 추가 호스팅 비용 0원
- **R5**: 자동 저장으로 인한 GitHub 커밋 spam 방지 (사용자 피드백 → 수동 Save)

## 검토한 선택지

| 선택지 | 장점 | 단점 |
|--------|------|------|
| A. localStorage 단독 | 단순, 빠름 | **R1 실패** — 5MB에서 silent fail |
| B. IndexedDB 단독 | R1 해결 | R2 미해결 — 디바이스 간 공유 불가 |
| C. **IndexedDB + GitHub** | R1·R2·R3·R4 모두 해결, 변경 이력은 git 자체 | 충돌 처리 직접 구현 필요 |
| D. SQLite (sql.js) + GitHub | 관계 쿼리 가능 | 번들 크기 ↑, GitHub sync 모델 재설계, 웹앱에서 비표준 |
| E. Firebase/Supabase | 실시간 sync 자동 | R4 위반 (무료 티어 한계 + 신용카드 등록), 외부 의존 |

## 결정

**C — 2계층 저장**. IndexedDB는 로컬 캐시(빠른 로딩 + 오프라인 폴백), GitHub은 원본(다중 디바이스 동기화 + 변경 이력). Save는 사용자가 명시적으로 누르고 Load는 탭 진입 시 자동.

```
┌──────────────┐  ┌───────────────┐  ┌──────────────┐
│ 메모리 cache  │  │   IndexedDB   │  │ localStorage │
│ (JS 변수)     │  │  (영구 저장)   │  │ (설정값만)    │
│              │  │              │  │              │
│ 맵 데이터     │  │ 맵 데이터     │  │ API 키       │
│ undo/redo    │  │ (비동기 백업)  │  │ 테마, GitHub │
└──────────────┘  └───────────────┘  └──────────────┘
                       ↕ 인터넷 (탭 진입 시 자동 Load, 사용자 Save)
                  ┌─────────────────────┐
                  │   GitHub Repo       │
                  │ data/maps/{id}.json │
                  │ data/maps-index.json│
                  └─────────────────────┘
```

| 행동 | 메모리 | IndexedDB | GitHub |
|------|--------|---------|--------|
| 앱 진입 | 1) IDB→cache (즉시) | (읽기) | 2) Pull → cache·IDB 덮어쓰기 |
| 편집 | 1) cache 즉시 + undo push | 2) 비동기 fire-and-forget | 미반영 |
| Save 클릭 | (변경 없음) | (변경 없음) | <1MB Contents API / ≥1MB Git Data API |
| Undo/Redo | 1) 스택에서 복원 | 2) 비동기 백업 | 미반영 |
| 탭 닫음 | 소멸 | 유지 | (이미 Save된 것만) |

크기 분기: <1MB은 Contents API PUT (단일 요청), ≥1MB는 Git Data API (blob → tree → commit → ref).

핵심 코드 경로:
- `src/services/mapService.ts` — IndexedDB CRUD + in-memory cache + Undo/Redo (50MB / 20개 cap)
- `src/services/githubService.ts` — Contents/Blob API + base64 + SHA 충돌 감지

## 시행착오

### `cache: 'no-store'` → CORS 실패
GitHub API에 캐시 우회를 시도하며 fetch 옵션에 `cache: 'no-store'`를 넣었더니 일부 브라우저에서 CORS preflight가 실패했다. 해결: URL 쿼리에 `?t=Date.now()`를 붙이는 cache-busting으로 전환. fetch 옵션은 건드리지 않음.

### `If-None-Match` 커스텀 헤더 → CORS preflight 실패
조건부 GET을 시도하다 같은 부류의 CORS 사고. GitHub 외 서버에서는 preflight를 늘리는 헤더 자체가 트리거가 됨. 해결: `If-None-Match` 사용 금지, ETag 비교 대신 SHA 비교로 대체.

### `raw.githubusercontent.com` + `Authorization` → 403
1MB 이상 파일을 빠르게 받으려 raw URL + 토큰 헤더를 시도했으나 raw CDN이 preflight를 미지원해 인증 헤더와 충돌. 해결: Git Blob API(`/git/blobs/{sha}`)로 받고 base64 디코드.

### `btoa(unescape(encodeURIComponent(...)))` → call stack overflow + 한글 깨짐
큰 JSON을 base64로 인코딩하다 한글·이모지 혼합 데이터에서 깨짐 + 수백 KB에서 stack overflow. 해결: `TextEncoder` Uint8Array → 8192 청크 분할 후 `String.fromCharCode(...chunk)` → `btoa`. 디코드는 `TextDecoder`. (`githubService.ts` `utf8ToBase64` / `base64ToUtf8`)

### Contents API >1MB silent fail
GitHub Contents API의 1MB 제한을 모르고 큰 파일을 PUT 하다 갑자기 422 에러. 해결: 크기 분기 도입 — <1MB Contents API, ≥1MB Git Data API 4단계(blob create → tree update → commit → ref update).

### 다중 탭 동시 Save → 후순위 덮어쓰기
SHA 충돌 감지(`getFileSha` 후 비교)는 구현돼 있으나 충돌 발생 시 사용자에게 throw만 하고 자동 머지/reload UI가 없다. 사용자가 "다시 저장하세요" 메시지를 보고 수동 reload 후 재시도해야 함. **Phase B에 등록된 잔여 과제**.

### auto-save → 수동 Save로 회귀
초기에는 5초 간격 auto-save를 시도했다. GitHub 커밋이 분당 1~2개씩 쌓이고, 다른 디바이스에서 conflict가 빈발했다. 사용자 피드백으로 "Save 버튼 명시 클릭"으로 변경. Load만 탭 진입 시 자동으로 유지.

## 결과

- **5MB → 사실상 무제한**: IndexedDB는 디스크의 1/3~2/3까지 사용 가능. localStorage는 600B(설정값만)
- **다중 디바이스 동기화 확보**: GitHub이 단일 진실원천, 다른 기기에서 자동 Pull
- **오프라인 가능**: IndexedDB 캐시로 인터넷 끊긴 상태에서도 편집 가능, 복구 후 Save
- **변경 이력은 git 자체**: 별도 history UI 없이 GitHub 커밋 로그가 곧 변경 로그
- **잔여 작업**: SHA 충돌 자동 reload + 3-way merge UI, IndexedDB quota warning, undo 스냅샷 IDB 백업 → Phase B에 등록
- **잠재 영향**: Phase C에서 Insight Schema export가 추가되면 같은 IndexedDB cache에서 변환만 하면 됨 (저장 모델 변경 불필요)
