import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { usePrompts } from '@/state/prompts';
import type { SystemPrompt } from '@/types';
import { PROMPT_PACK } from '@/data/promptPack';
import { theme } from '@/theme';

/** The named system-prompt library: create, name, save, edit, and delete. */
export default function PromptsScreen() {
  const prompts = usePrompts((s) => s.prompts);
  const create = usePrompts((s) => s.create);
  const update = usePrompts((s) => s.update);
  const remove = usePrompts((s) => s.remove);

  const [editing, setEditing] = useState<SystemPrompt | 'new' | null>(null);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');

  const startNew = () => {
    setEditing('new');
    setName('');
    setBody('');
  };
  const startEdit = (p: SystemPrompt) => {
    setEditing(p);
    setName(p.name);
    setBody(p.body);
  };
  const save = async () => {
    if (!name.trim() || !body.trim()) return;
    if (editing === 'new') await create(name.trim(), body.trim());
    else if (editing) await update(editing.id, { name: name.trim(), body: body.trim() });
    setEditing(null);
  };

  const importPack = async () => {
    const existing = new Set(prompts.map((p) => p.name));
    for (const p of PROMPT_PACK) {
      if (!existing.has(p.name)) await create(p.name, p.body);
    }
  };

  if (editing) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: theme.space(3), gap: theme.space(3) }}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name (e.g. “Senior Python reviewer”)"
          placeholderTextColor={theme.colors.textDim}
          style={{ color: theme.colors.text, backgroundColor: theme.colors.surface, borderRadius: theme.radius.sm, padding: theme.space(3.5), fontSize: 15, borderWidth: 1, borderColor: theme.colors.border }}
        />
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="System prompt text…"
          placeholderTextColor={theme.colors.textDim}
          multiline
          style={{ color: theme.colors.text, backgroundColor: theme.colors.surface, borderRadius: theme.radius.sm, padding: theme.space(3.5), fontSize: 15, minHeight: 220, textAlignVertical: 'top', borderWidth: 1, borderColor: theme.colors.border }}
        />
        <View style={{ flexDirection: 'row', gap: theme.space(2) }}>
          <Pressable onPress={save} style={{ flex: 1, backgroundColor: theme.colors.accent, borderRadius: theme.radius.sm, padding: theme.space(3.5), alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Save prompt</Text>
          </Pressable>
          <Pressable onPress={() => setEditing(null)} style={{ paddingHorizontal: theme.space(4), justifyContent: 'center' }}>
            <Text style={{ color: theme.colors.textDim }}>Cancel</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: theme.space(3), gap: theme.space(2) }}>
      <View style={{ flexDirection: 'row', gap: theme.space(2), marginBottom: theme.space(2) }}>
        <Pressable onPress={startNew} style={{ flex: 1, backgroundColor: theme.colors.accent, borderRadius: theme.radius.md, padding: theme.space(3.5), alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>+ New prompt</Text>
        </Pressable>
        <Pressable onPress={importPack} style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md, paddingVertical: theme.space(3.5), paddingHorizontal: theme.space(4), alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Starter pack</Text>
        </Pressable>
      </View>

      {prompts.length === 0 ? (
        <Text style={{ color: theme.colors.textDim, textAlign: 'center', padding: theme.space(8) }}>
          No saved prompts yet. Create reusable prompts and apply them to any chat.
        </Text>
      ) : (
        prompts.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => startEdit(p)}
            onLongPress={() => remove(p.id)}
            style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: theme.space(4), borderWidth: 1, borderColor: theme.colors.border }}
          >
            <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '600' }}>{p.name}</Text>
            <Text numberOfLines={2} style={{ color: theme.colors.textDim, fontSize: 13, marginTop: 4 }}>
              {p.body}
            </Text>
          </Pressable>
        ))
      )}
      <Text style={{ color: theme.colors.textDim, fontSize: 11, textAlign: 'center', marginTop: theme.space(2) }}>
        Tap to edit · long-press to delete
      </Text>
    </ScrollView>
  );
}
