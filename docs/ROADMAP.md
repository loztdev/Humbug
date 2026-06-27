# Roadmap

Built incrementally across turns. Checked = landed.

## Phase 1 — Engine (done)
- [x] Project scaffold (Expo, TypeScript, Expo Router config)
- [x] Provider abstraction + Anthropic, OpenAI, OpenRouter, Gemini, z.ai
- [x] Streaming via `expo/fetch` with unified SSE + error handling
- [x] Semantic memory: embeddings, cosine retrieval, recency boost
- [x] Meaning-preserving compaction with 50–97% retention slider logic
- [x] Secure API-key storage (OS keystore)
- [x] Unit tests for pure engine logic

## Phase 2 — Persistence + UI (done)
- [x] SQLite schema + repositories (chats, messages, memories, prompts, settings)
- [x] Zustand stores wiring engine ↔ UI (settings, prompts, chats)
- [x] Chat list + chat screen with token-by-token streaming render
- [x] Settings: provider/model pickers, embeddings-provider picker, key manager
- [x] System-prompt library (create / name / save / edit / apply)
- [x] Auto-memory: each turn is distilled into long-term memory and recalled

## Phase 3 — Files, export, compaction UX
- [x] Export all / individual chats (Markdown + JSON) via `expo-sharing`
- [x] Compaction UI (stepped retention picker with live gains explainer)
- [ ] Continuous slider for retention (currently stepped 50/60/70/80/90/97)
- [ ] File uploads (`expo-document-picker`) + text extraction for context
- [ ] Memory browser/editor (view, pin, delete memories)

## Phase 4 — Polish
- [ ] Markdown rendering in assistant bubbles (code blocks, lists)
- [ ] Token/cost accounting per chat with a pricing table
- [ ] Dynamic model lists from `listModels()` in the pickers
- [ ] Theming, accessibility pass
- [ ] iOS support

## Ideas worth considering
- Prompt cost preview before sending (per-provider pricing)
- "Pin to memory" on any message
- Cross-chat vs per-chat memory scoping
- Local-only embeddings (on-device) to avoid an embeddings key
- Conversation branching / forking
