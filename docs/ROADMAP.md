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

## Phase 5 — Backup, branching, cost preview (done)
- [x] Encrypted backup & restore of the whole library (#12) — PBKDF2 + AES-256
- [x] Edit-and-resend a message (#9)
- [x] Conversation branching / forking (#4)
- [x] "Estimated cost before sending" preview

## Phase 6 — Local memory, custom models, council (done)
- [x] Local on-device embeddings (feature hashing), selectable vs. API (#5)
- [x] Custom / self-hosted OpenAI-compatible endpoints, incl. Ollama (#14)
- [x] Prompt template starter pack (#7)
- [x] Multi-model "council" compare (#8)

## Later (kept in mind)
- [ ] Voice input/output (#6) — needs native speech (STT/TTS)
- [ ] Themes, light mode, chat density (#15) — needs a runtime theme refactor
- [ ] Dynamic model lists from `listModels()` in pickers
- [ ] iOS pass; accessibility pass
