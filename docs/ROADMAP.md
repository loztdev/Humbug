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

## Phase 2 — Persistence + UI
- [ ] SQLite schema + repositories (chats, messages, memories, prompts)
- [ ] Zustand stores wiring engine ↔ UI
- [ ] Chat list + chat screen with streaming render
- [ ] Settings: providers/keys, model picker, embeddings-provider picker
- [ ] System-prompt library (create / name / save / apply)

## Phase 3 — Files, export, compaction UX
- [ ] File uploads (`expo-document-picker`) + text extraction for context
- [ ] Export all / individual chats (JSON + Markdown) via `expo-sharing`
- [ ] Compaction slider UI with the live gains explainer
- [ ] Auto-memory: distill chat turns into memories in the background

## Phase 4 — Polish
- [ ] Per-chat memory toggle + memory browser/editor
- [ ] Token/usage accounting per chat
- [ ] Theming, accessibility pass
- [ ] iOS support

## Ideas worth considering
- Prompt cost preview before sending (per-provider pricing table)
- "Pin to memory" on any message
- Cross-chat memory scoping (global vs per-chat)
- Local-only embeddings option (on-device model) to avoid an embeddings key
- Conversation branching / forking
