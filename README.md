# Humbug

A bring-your-own-key AI chat app for mobile (React Native + Expo, Android-first)
with an advanced semantic memory engine, meaning-preserving compaction, file
uploads, persistent exportable chats, and a saveable library of system prompts.

Humbug is going to be something extraordinary.

## Status

Feature-complete against the original brief plus a large wishlist, and runnable
(Android-first). Pure engine logic is unit-tested; see
[docs/ROADMAP.md](docs/ROADMAP.md) for what's done and what's queued.

## What it does

- **Connect any API key** — Anthropic (Claude), OpenAI, OpenRouter, Google
  Gemini, z.ai (Zhipu), plus a **custom OpenAI-compatible endpoint** (Ollama,
  LM Studio, vLLM, …), behind one unified interface. Adding more is one entry.
- **Advanced memory** — every message/memory is embedded into a vector; on each
  turn only the most *semantically relevant* pieces are retrieved and injected.
  Use an API embeddings provider **or on-device embeddings** (no key needed).
  Browse, search, pin, edit, and delete memories.
- **Meaning-preserving compaction** — a continuous slider (50%→97%) sets how
  much meaning to keep when condensing long threads, with an honest gains
  explainer; auto-suggested when a chat nears the context window.
- **Persistent, exportable chats** — stored locally; export all or individual
  as Markdown/JSON, or take a **passphrase-encrypted backup** of everything.
- **Named system prompts** — save/name/reuse, plus a one-tap starter pack.
- **File uploads** — attach documents (text extracted into context) and images
  (sent to vision models).
- **Markdown replies** with copyable code blocks; **per-message cost/token**
  meter and a cost-to-send preview.
- **Per-message actions** — copy, pin to memory, regenerate, delete,
  edit-and-resend, and **branch** a new chat from any point.
- **Global search** across chats, messages, and memories.
- **Multi-model council** — ask 2–3 models the same prompt and compare.
- **App lock** — optional biometric / device-PIN gate.

## Architecture

```
app/         Expo Router screens (UI)               — upcoming
src/
  types/     Shared domain types
  providers/ BYO-key multi-provider engine          — done
  memory/    Semantic vector memory + retrieval     — done
  compaction/Meaning-preserving compactor           — done
  storage/   Secure key store (+ SQLite, upcoming)
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design in depth.

## Development

```bash
npm install
npm run typecheck
npm test
npm run android   # requires Android device/emulator + Expo
```

> API keys are stored in the OS keystore (Android Keystore / iOS Keychain) via
> `expo-secure-store`, never in plain storage.
