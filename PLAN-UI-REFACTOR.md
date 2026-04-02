# PLAN: UI Refactor + Bug Fixes + Multi-API

Date: 2026-04-02
Status: Draft (interview complete)

---

## Issue Summary

| # | Issue | Priority |
|---|-------|----------|
| 1 | Sidebar→bridge drag-drop broken (paper not added to bridge) | HIGH |
| 2 | AI Chat "추가" button: paper added to global list but NOT to bridge's paperIds | HIGH |
| 3 | 3-panel layout: AI Chat + DetailPanel + DeepStudy side-by-side | MEDIUM |
| 4 | Chat history lost on bridge switch → per-bridge preservation, manual reset only | MEDIUM |
| 5 | Multi-API support: Gemini + Claude + GPT in Settings | MEDIUM |
| 6 | UI language → all English | LOW |

---

## 1. Bug Fix: Drag-Drop & AI Chat Add

### Problem
- AI Chat "추가" adds paper to global papers list but does NOT add it to the bridge/road's `paperIds` → DetailPanel doesn't show it.
- Sidebar→bridge drag-drop also fails to add paper to bridge.

### Root Cause Investigation Plan
- **AI Chat add**: `AIChatPanel.handleAddPaper` calls `onAddPaper(paper)` then `onAddPaperToBridge(actualId, entity.id)`. In OverviewPage, `onAddPaper` is `ctx.addPaper(paper)` and `onAddPaperToBridge` is `ctx.addPaperToBridge(paperId, bridgeId)`. Need to verify these callbacks are wired correctly after the panel separation refactor.
- **Drag-drop**: `IslandMap.onPaperDropOnBridge` calls `ctx.addPaperToBridge(paperId, bridgeId)`. Need to check if the drop target hit detection is working.

### Files to Check
- `src/pages/OverviewPage.tsx` — AIChatPanel callback props
- `src/pages/IslandDetailPage.tsx` — same for roads
- `src/components/IslandMap.tsx` — drop handler, hit detection
- `src/components/CityMap.tsx` — same for roads
- `src/hooks/useMapData.ts` — `addPaperToBridge`, `addPaperToRoad` implementations

---

## 2. 3-Panel Layout: AI Chat | DetailPanel | DeepStudy

### Target Layout
```
┌──────┬────────┬──────────┬────────────┬────────────┐
│Side  │  Map   │ AI Chat  │DetailPanel │ DeepStudy  │
│bar   │        │ (resize) │ (resize)   │ (resize)   │
│      │        │          │ Papers     │ AI Summary │
│      │        │          │ Gaps       │ Figures    │
└──────┴────────┴──────────┴────────────┴────────────┘
```

### Behavior
- AI Chat: toggle via "AI" button in DetailPanel header (already done)
- DeepStudy: opens when paper is **double-clicked** in DetailPanel, or **clicked** in Sidebar
- All 3 panels can be open simultaneously
- Each panel has resize handle (drag boundary)
- Map shrinks to accommodate panels

### Changes
- `OverviewPage.tsx` / `IslandDetailPage.tsx`: render order = `[Map] [AIChatPanel?] [DetailPanel?] [PaperStudyPanel?]`
- `DetailPanel.tsx`: paper double-click → `onStudyPaper(paperId)` callback
- `PaperStudyPanel.tsx`: render as side panel (not overlay), same height as other panels
- Current behavior: PaperStudyPanel replaces map area (flex 0.4 : 0.6). **New**: PaperStudyPanel is a fixed-width resizable panel to the RIGHT of DetailPanel.

---

## 3. Chat History Preservation

### Current
- `useAIChat` hook resets messages when `entity?.id` changes (line 78-82 in useAIChat.ts)
- Switching bridges destroys all chat history

### Target
- Store chat messages per entity ID in a `Map<string, ChatMessage[]>` (in-memory, NOT persisted)
- On entity switch: save current messages, restore previous messages for new entity
- Manual reset only: "New Chat" button clears current entity's history
- No auto-reset on bridge/road change

### Changes
- `src/hooks/useAIChat.ts`: replace `useEffect` reset with a `Map`-based store
- `src/components/AIChatPanel.tsx`: add "New Chat" button in header

---

## 4. Multi-API Settings

### Target
- Settings modal supports 3 providers: Gemini, Claude, GPT
- Each has its own API key field
- User selects which provider to use as default for:
  - AI Chat (tool use + conversation)
  - Paper summary (PaperStudyPanel)
  - Deep Search LLM rerank
- Stored in localStorage

### Changes
- `src/components/ClaudeSettings.tsx` → rename to `AISettings.tsx`
  - 3 tabs/sections: Gemini / Claude / GPT
  - Each: API key input + test button
  - Default provider selector dropdown
- `src/services/geminiService.ts` — already exists
- `src/services/aiService.ts` — Claude already exists
- `src/services/openaiService.ts` — NEW: GPT API wrapper
- `src/services/aiChatService.ts` — use selected provider for chat
- `src/services/deepSearchService.ts` — use selected provider for rerank

---

## 5. UI Language → English

### Scope: UI text only (buttons, labels, placeholders, tooltips)
### AI responses: follow user language (system prompt already says "respond in same language")

### Files to scan & update
- All `.tsx` components: Korean strings → English
- System prompts in `aiChatService.ts`: keep "respond in same language" instruction
- Tool status messages in `aiChatService.ts`, `useAIChat.ts`

### NOT changed
- AI response language (user decides)
- Data content (user's island/bridge names stay as-is)
- Commit messages convention

---

## Execution Order

1. **Bug fixes first** (1): drag-drop + AI Chat add → verify callbacks work
2. **Chat preservation** (3.2): per-bridge chat history
3. **3-panel layout** (3.1): side-by-side with resize
4. **UI English** (3.4): string replacements
5. **Multi-API** (2): Settings + provider abstraction
6. **DeepStudy from DetailPanel** (3.1 sub): double-click to open

---

## Verification

- [ ] Sidebar drag paper → bridge → paper appears in DetailPanel
- [ ] AI Chat "추가" → paper appears in DetailPanel immediately
- [ ] Switch bridge → switch back → chat history preserved
- [ ] "New Chat" button resets only current bridge's chat
- [ ] 3 panels visible simultaneously, each resizable
- [ ] DetailPanel paper double-click → DeepStudy opens
- [ ] All UI text in English
- [ ] Settings: Gemini/Claude/GPT key input, provider selection
- [ ] `npm run build` passes
