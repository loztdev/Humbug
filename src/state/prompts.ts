import { create } from 'zustand';
import type { SystemPrompt } from '@/types';
import {
  createPrompt,
  deletePrompt,
  listPrompts,
  updatePrompt,
} from '@/storage/promptsRepo';

/** Store for the named system-prompt library. */

interface PromptsState {
  prompts: SystemPrompt[];
  loaded: boolean;
  load: () => Promise<void>;
  create: (name: string, body: string) => Promise<SystemPrompt>;
  update: (id: string, patch: Partial<Pick<SystemPrompt, 'name' | 'body'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const usePrompts = create<PromptsState>((set, get) => ({
  prompts: [],
  loaded: false,

  load: async () => {
    set({ prompts: await listPrompts(), loaded: true });
  },

  create: async (name, body) => {
    const p = await createPrompt(name, body);
    set({ prompts: [p, ...get().prompts] });
    return p;
  },

  update: async (id, patch) => {
    await updatePrompt(id, patch);
    set({
      prompts: get().prompts.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
      ),
    });
  },

  remove: async (id) => {
    await deletePrompt(id);
    set({ prompts: get().prompts.filter((p) => p.id !== id) });
  },
}));
