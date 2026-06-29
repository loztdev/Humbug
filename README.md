# Humbug

A bring-your-own-key AI chat app for mobile (React Native + Expo, Android-first)
with an advanced semantic memory engine, meaning-preserving compaction, file
uploads, persistent exportable chats, and a saveable library of system prompts.

Humbug is going to be something extraordinary.

## Status

Early development. The **engine layer** (provider abstraction, semantic memory,
compaction, secure key storage) is implemented and unit-tested. The UI and
persistence layers are next — see [docs/ROADMAP.md](docs/ROADMAP.md).

## What it does

- **Connect any API key** — Anthropic (Claude), OpenAI, OpenRouter, Google
  Gemini, and z.ai (Zhipu) are supported out of the box, behind one unified
  interface. Adding more providers is a single registry entry.
- **Advanced memory** — every message/memory is embedded into a vector; on each
  turn only the most *semantically relevant* pieces are retrieved and injected,
  so the model loads only what matters instead of the whole history.
- **Meaning-preserving compaction** — a slider (50%→97%) sets how much of the
  original meaning to keep when condensing long threads, with an honest
  in-app explainer about diminishing returns near the top.
- **Persistent, exportable chats** — chats are stored locally and can be
  exported all at once or individually.
- **Named system prompts** — save, name, and reuse system prompts across chats.
- **File uploads** — attach documents/images for context.

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
