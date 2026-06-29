import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import type { Chat, Message, MemoryItem } from '@/types';
import { searchChats } from '@/storage/chatsRepo';
import { searchMessages } from '@/storage/messagesRepo';
import { searchMemories } from '@/storage/memoriesRepo';
import { theme } from '@/theme';

type Result =
  | { kind: 'chat'; chat: Chat }
  | { kind: 'message'; message: Message }
  | { kind: 'memory'; memory: MemoryItem };

/** Global full-text search across chats, messages, and memories. */
export default function SearchScreen() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Result[]>([]);

  const run = async (text: string) => {
    setQ(text);
    const t = text.trim();
    if (!t) {
      setResults([]);
      return;
    }
    const [chats, messages, memories] = await Promise.all([
      searchChats(t),
      searchMessages(t),
      searchMemories(t),
    ]);
    setResults([
      ...chats.map((chat) => ({ kind: 'chat' as const, chat })),
      ...messages.map((message) => ({ kind: 'message' as const, message })),
      ...memories.map((memory) => ({ kind: 'memory' as const, memory })),
    ]);
  };

  const counts = useMemo(() => {
    const c = { chat: 0, message: 0, memory: 0 };
    for (const r of results) c[r.kind]++;
    return c;
  }, [results]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <Stack.Screen options={{ title: 'Search' }} />
      <TextInput
        value={q}
        onChangeText={run}
        autoFocus
        placeholder="Search everything…"
        placeholderTextColor={theme.colors.textDim}
        style={{ color: theme.colors.text, backgroundColor: theme.colors.surface, margin: theme.space(3), borderRadius: theme.radius.sm, padding: theme.space(3), fontSize: 15, borderWidth: 1, borderColor: theme.colors.border }}
      />
      {q.trim() ? (
        <Text style={{ color: theme.colors.textDim, fontSize: 12, paddingHorizontal: theme.space(4), paddingBottom: theme.space(2) }}>
          {counts.chat} chats · {counts.message} messages · {counts.memory} memories
        </Text>
      ) : null}
      <FlatList
        data={results}
        keyExtractor={(r, i) =>
          r.kind === 'chat' ? r.chat.id : r.kind === 'message' ? r.message.id : `${r.memory.id}-${i}`
        }
        contentContainerStyle={{ paddingHorizontal: theme.space(3), gap: theme.space(2), paddingBottom: theme.space(6) }}
        renderItem={({ item }) => {
          if (item.kind === 'chat') {
            return (
              <Row tag="Chat" text={item.chat.title} onPress={() => router.push(`/chat/${item.chat.id}`)} />
            );
          }
          if (item.kind === 'message') {
            return (
              <Row
                tag={item.message.role === 'user' ? 'You' : 'Assistant'}
                text={item.message.content}
                onPress={() => router.push(`/chat/${item.message.chatId}`)}
              />
            );
          }
          return <Row tag="Memory" text={item.memory.content} />;
        }}
      />
    </View>
  );
}

function Row({ tag, text, onPress }: { tag: string; text: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: theme.space(3.5), borderWidth: 1, borderColor: theme.colors.border }}
    >
      <Text style={{ color: theme.colors.accent, fontSize: 11, marginBottom: 4 }}>{tag}</Text>
      <Text numberOfLines={3} style={{ color: theme.colors.text, fontSize: 14, lineHeight: 20 }}>
        {text}
      </Text>
    </Pressable>
  );
}
