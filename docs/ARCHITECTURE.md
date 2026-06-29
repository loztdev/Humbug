# Architecture

Humbug is layered so each feature is independent and testable. The "engine"
(everything under `src/`) has no UI dependencies and can run headless.

## Provider abstraction (`src/providers`)

Every AI service implements one `Provider` interface (`types.ts`):
`streamChat()` (an async generator of text deltas + usage) and an optional
`embed()`. The rest of the app never branches on which provider is active.

- **OpenAI, OpenRouter, z.ai** share the OpenAI Chat Completions wire format and
  are built from one factory (`openaiCompat.ts`) — each is a config object.
- **Anthropic** (`anthropic.ts`) and **Gemini** (`gemini.ts`) have bespoke
  adapters because their request/stream shapes differ.
- `registry.ts` is the single source of truth; `getProvider(id)` resolves one.

Streaming uses `expo/fetch` (`stream.ts`) because React Native's built-in
`fetch` does not expose a readable body stream. SSE parsing and HTTP→user-facing
error mapping are centralized there.

**Embeddings caveat:** Anthropic and OpenRouter expose no embeddings endpoint.
`embeddingProviders()` returns only those that can power memory (OpenAI, Gemini,
z.ai), so the UI can let users pick a chat provider and an embeddings provider
independently.

## Semantic memory (`src/memory`)

`similarity.ts` — pure cosine-similarity + top-K ranking (no native deps).

`retrieval.ts` — the "load only what's relevant" engine:

1. `ensureEmbeddings()` backfills vectors for any memory missing one (batched).
2. `retrieveRelevant()` embeds the query, scores every comparable memory by
   cosine similarity, applies a recency/frequency boost, and returns the top-K
   above a threshold.
3. `formatMemoryBlock()` renders the winners for injection into the system
   prompt.

Vectors are only compared within the same embedding model (cross-model vectors
aren't comparable), so each `MemoryItem` records its `embeddingModel`.

## Compaction (`src/compaction`)

`compactor.ts` turns a meaning-retention ratio into a compression instruction.

- The slider runs **50%–97%**, deliberately not 100%: at true 100% there's no
  summarization and therefore no token savings, so it's a no-op. `gainsAssessment()`
  surfaces this honestly and flags low-gain settings.
- `targetLengthFraction()` maps retention → approximate kept length on a
  sub-linear curve (lots of conversation is redundant, so even high retention
  frees real space).
- `buildCompactionSystemPrompt()` prioritizes decisions > facts > open threads >
  goals, and forbids dropping a fact to hit a length target (fidelity > brevity).
- `compactConversation()` streams the summary via the active provider; the caller
  replaces the compacted messages with one summary message (`Message.compactionOf`).

## Storage (`src/storage`)

`secureKeys.ts` keeps API keys in the OS keystore via `expo-secure-store`.
Chats/messages/memories will live in SQLite (`expo-sqlite`) — upcoming.

## Types (`src/types`)

All domain types (`Chat`, `Message`, `SystemPrompt`, `MemoryItem`, `Attachment`)
live here, free of UI/storage specifics so every layer can share them.
