# Roadmap

Built incrementally across turns. Checked = landed.

## Phase 1 — Engine (done)
- [x] Project scaffold (Expo, TypeScript, Expo Router config)
- [x] Provider abstraction + Anthropic, OpenAI, OpenRouter, Gemini, z.ai
- [x] Streaming via `expo/fetch` with unified SSE + error handling
- [x] Semantic memory: embeddings, cosine retrieval, recency boost
- [x] Meaning-preserving compaction (50–97% retention)
- [x] Secure API-key storage (OS keystore)

## Phase 2 — Persistence + UI (done)
- [x] SQLite schema + repositories; Zustand stores wiring engine ↔ UI
- [x] Chat list + streaming chat view; settings & provider/key manager
- [x] System-prompt library; auto-memory distilled from each turn

## Phase 3 — Files, export, compaction UX (done)
- [x] Export all / individual chats (Markdown + JSON)
- [x] Continuous compaction slider with live gains explainer
- [x] File uploads: document text extraction + images to vision models
- [x] Memory browser/editor (search, pin, edit, delete)

## Phase 4 — Power features (done)
- [x] Markdown rendering in replies (code blocks + copy, lists, links)
- [x] Per-message cost + per-chat token/cost meter (approx pricing table)
- [x] Per-message actions (copy, pin to memory, regenerate, delete)
- [x] Global search across chats, messages, and memories
- [x] App lock (biometric / device PIN)
- [x] Auto-compact suggestion when nearing the context window

## Phase 5 — Next up
- [ ] Local on-device embeddings, selectable vs. API embeddings (#5)
- [ ] Encrypted backup & restore of the whole library (#12)
- [ ] Edit-and-resend a message; conversation branching/forking (#4, #9)
- [ ] "Estimated cost before sending" preview

## Later (kept in mind)
- [ ] Voice input/output (#6)
- [ ] Prompt template starter pack (#7)
- [ ] Multi-model "council" compare (#8)
- [ ] Custom / self-hosted OpenAI-compatible endpoints, incl. Ollama (#14)
- [ ] Themes, light mode, chat density (#15)
- [ ] Dynamic model lists from `listModels()`; iOS pass; accessibility
