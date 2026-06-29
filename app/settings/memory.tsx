import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useMemories } from '@/state/memories';
import type { MemoryItem } from '@/types';
import { theme } from '@/theme';

/** Memory browser: search, pin, edit, and delete long-term memories. */
export default function MemoryScreen() {
  const memories = useMemories((s) => s.memories);
  const load = useMemories((s) => s.load);
  const search = useMemories((s) => s.search);
  const togglePin = useMemories((s) => s.togglePin);
  const edit = useMemories((s) => s.edit);
  const remove = useMemories((s) => s.remove);

  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<MemoryItem | null>(null);
  const [draft, setDraft] = useState('');

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onSearch = (text: string) => {
    setQ(text);
    search(text);
  };

  if (editing) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg, padding: theme.space(3), gap: theme.space(3) }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          multiline
          autoFocus
          style={{ color: theme.colors.text, backgroundColor: theme.colors.surface, borderRadius: theme.radius.sm, padding: theme.space(3.5), fontSize: 15, minHeight: 160, textAlignVertical: 'top', borderWidth: 1, borderColor: theme.colors.border }}
        />
        <View style={{ flexDirection: 'row', gap: theme.space(2) }}>
          <Pressable
            onPress={async () => { await edit(editing.id, draft.trim()); setEditing(null); }}
            style={{ flex: 1, backgroundColor: theme.colors.accent, borderRadius: theme.radius.sm, padding: theme.space(3.5), alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
          </Pressable>
          <Pressable onPress={() => setEditing(null)} style={{ paddingHorizontal: theme.space(4), justifyContent: 'center' }}>
            <Text style={{ color: theme.colors.textDim }}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <TextInput
        value={q}
        onChangeText={onSearch}
        placeholder="Search memories…"
        placeholderTextColor={theme.colors.textDim}
        style={{ color: theme.colors.text, backgroundColor: theme.colors.surface, margin: theme.space(3), borderRadius: theme.radius.sm, padding: theme.space(3), fontSize: 15, borderWidth: 1, borderColor: theme.colors.border }}
      />
      <FlatList
        data={memories}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingHorizontal: theme.space(3), paddingBottom: theme.space(6), gap: theme.space(2) }}
        ListEmptyComponent={
          <Text style={{ color: theme.colors.textDim, textAlign: 'center', padding: theme.space(8) }}>
            No memories yet. They’re created automatically as you chat (with memory on), or pin any message to memory.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => { setEditing(item); setDraft(item.content); }}
            onLongPress={() => remove(item.id)}
            style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: theme.space(3.5), borderWidth: 1, borderColor: item.pinned ? theme.colors.accent : theme.colors.border }}
          >
            <Text numberOfLines={4} style={{ color: theme.colors.text, fontSize: 14, lineHeight: 20 }}>
              {item.content}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: theme.space(2) }}>
              <Text style={{ color: theme.colors.textDim, fontSize: 11 }}>
                {new Date(item.createdAt).toLocaleDateString()}
                {item.embedding ? ' · embedded' : ' · not embedded'}
              </Text>
              <Pressable onPress={() => togglePin(item.id, !item.pinned)} hitSlop={8}>
                <Text style={{ color: item.pinned ? theme.colors.accent : theme.colors.textDim, fontSize: 13 }}>
                  {item.pinned ? '📌 Pinned' : 'Pin'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        )}
      />
      <Text style={{ color: theme.colors.textDim, fontSize: 11, textAlign: 'center', paddingBottom: theme.space(3) }}>
        Tap to edit · long-press to delete · pinned memories are always recalled
      </Text>
    </View>
  );
}
