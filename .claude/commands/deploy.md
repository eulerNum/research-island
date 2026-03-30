변경사항을 커밋하고 GitHub에 push합니다. (commit + push 한번에)

1. `git status`로 변경사항 확인 — 없으면 "변경사항 없음" 보고 후 종료
2. `git diff --stat`으로 변경 파일 목록 확인
3. 변경 내용을 분석하여 한국어 커밋 메시지 자동 생성 (conventional commits)
4. 모든 변경 파일 `git add` + `git commit`
5. `git push`로 origin에 push
6. 결과 보고

인자: $ARGUMENTS (선택 — 커밋 메시지를 직접 지정할 수 있음)
