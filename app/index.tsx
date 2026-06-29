import { useCallback } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Link, Stack, useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChats } from '@/state/chats';
import { exportAll } from '@/export/exporter';
import { theme } from '@/theme';

/** Home: list of chats with quick actions to create, open, and export. */
export default function ChatListScreen() {
  const router = useRouter();
  const chats = useChats((s) => s.chats);
  const loadChats = useChats((s) => s.loadChats);
  const newChat = useChats((s) => s.newChat);
  const deleteChat = useChats((s) => s.deleteChat);

  useFocusEffect(useCallback(() => { loadChats(); }, [loadChats]));

  const onNew = async () => {
    const chat = await newChat();
    router.push(`/chat/${chat.id}`);
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: theme.space(2) }}>
              <Link href="/council" style={{ color: theme.colors.accent, fontSize: 18, paddingHorizontal: 6 }}>
                ⚖
              </Link>
              <Link href="/search" style={{ color: theme.colors.accent, fontSize: 20, paddingHorizontal: 6 }}>
                ⌕
              </Link>
              <Link href="/settings" style={{ color: theme.colors.accent, fontSize: 20, paddingHorizontal: 6 }}>
                ⚙︎
              </Link>
            </View>
          ),
        }}
      />
      <FlatList
        data={chats}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: theme.space(3), gap: theme.space(2) }}
        ListEmptyComponent={
          <View style={{ padding: theme.space(10), alignItems: 'center' }}>
            <Text style={{ color: theme.colors.textDim, textAlign: 'center', lineHeight: 22 }}>
              No chats yet.{'\n'}Tap “New chat” to begin.{'\n\n'}
              First, add an API key in Settings → Providers.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/chat/${item.id}`)}
            onLongPress={() => deleteChat(item.id)}
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.md,
              padding: theme.space(4),
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <Text numberOfLines={1} style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600' }}>
              {item.title}
            </Text>
            <Text style={{ color: theme.colors.textDim, fontSize: 12, marginTop: 4 }}>
              {item.model} · {new Date(item.updatedAt).toLocaleDateString()}
              {item.memoryEnabled ? ' · memory on' : ''}
            </Text>
          </Pressable>
        )}
      />

      <View style={{ flexDirection: 'row', gap: theme.space(2), padding: theme.space(3) }}>
        <Pressable
          onPress={onNew}
          style={{
            flex: 1,
            backgroundColor: theme.colors.accent,
            borderRadius: theme.radius.md,
            paddingVertical: theme.space(3.5),
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>+ New chat</Text>
        </Pressable>
        {chats.length > 0 ? (
          <Pressable
            onPress={() => exportAll('markdown')}
            style={{
              backgroundColor: theme.colors.surfaceAlt,
              borderRadius: theme.radius.md,
              paddingVertical: theme.space(3.5),
              paddingHorizontal: theme.space(4),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Export all</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
