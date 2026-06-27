import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChats } from '@/state/chats';
import { usePrompts } from '@/state/prompts';
import { allProviders, getProvider } from '@/providers';
import type { Message, ProviderId } from '@/types';
import { PickerModal, type PickerOption } from '@/components/PickerModal';
import { exportChat } from '@/export/exporter';
import { gainsAssessment, RETENTION } from '@/compaction/compactor';
import { useSettings } from '@/state/settings';
import { theme } from '@/theme';

type OpenModal = 'model' | 'prompt' | 'compact' | null;

const RETENTION_STEPS = [0.5, 0.6, 0.7, 0.8, 0.9, RETENTION.max];

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chats = useChats((s) => s.chats);
  const messages = useChats((s) => s.messages);
  const streaming = useChats((s) => s.streaming);
  const error = useChats((s) => s.error);
  const memHits = useChats((s) => s.lastMemoryHits);
  const openChat = useChats((s) => s.openChat);
  const send = useChats((s) => s.send);
  const stop = useChats((s) => s.stop);
  const setChatModel = useChats((s) => s.setChatModel);
  const setSystemPrompt = useChats((s) => s.setSystemPrompt);
  const toggleMemory = useChats((s) => s.toggleMemory);
  const compactCurrent = useChats((s) => s.compactCurrent);
  const clearError = useChats((s) => s.clearError);

  const prompts = usePrompts((s) => s.prompts);
  const retentionDefault = useSettings((s) => s.settings.compactionRetention);

  const [draft, setDraft] = useState('');
  const [modal, setModal] = useState<OpenModal>(null);
  const listRef = useRef<FlatList<Message>>(null);

  const chat = useMemo(() => chats.find((c) => c.id === id), [chats, id]);

  useFocusEffect(
    useCallback(() => {
      if (id) openChat(id);
    }, [id, openChat]),
  );

  const onSend = () => {
    const text = draft.trim();
    if (!text || streaming) return;
    setDraft('');
    send(text);
  };

  const modelOptions: PickerOption[] = useMemo(
    () =>
      allProviders().flatMap((p) =>
        p.staticModels.map((m) => ({
          label: m.label ?? m.id,
          value: `${p.id}::${m.id}`,
          sublabel: p.name,
        })),
      ),
    [],
  );

  const promptOptions: PickerOption[] = useMemo(
    () => [
      { label: 'None', value: '' },
      ...prompts.map((p) => ({ label: p.name, value: p.id, sublabel: p.body.slice(0, 50) })),
    ],
    [prompts],
  );

  const compactOptions: PickerOption[] = useMemo(
    () =>
      RETENTION_STEPS.map((r) => {
        const g = gainsAssessment(r);
        return {
          label: `${Math.round(r * 100)}% meaning kept`,
          value: String(r),
          sublabel: g.message,
        };
      }),
    [],
  );

  if (!chat) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <Stack.Screen
        options={{
          title: chat.title,
          headerRight: () => (
            <Pressable onPress={() => exportChat(chat.id, 'markdown')}>
              <Text style={{ color: theme.colors.accent, paddingHorizontal: 8 }}>Export</Text>
            </Pressable>
          ),
        }}
      />

      {/* Action chips */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space(2), padding: theme.space(3) }}>
        <Chip label={`◆ ${chat.model}`} onPress={() => setModal('model')} />
        <Chip
          label={`✎ ${chat.systemPromptId ? prompts.find((p) => p.id === chat.systemPromptId)?.name ?? 'Prompt' : 'No prompt'}`}
          onPress={() => setModal('prompt')}
        />
        <Chip
          label={chat.memoryEnabled ? '🧠 Memory on' : '🧠 Memory off'}
          active={chat.memoryEnabled}
          onPress={() => toggleMemory(chat.id, !chat.memoryEnabled)}
        />
        <Chip label="🗜 Compact" onPress={() => setModal('compact')} />
      </View>

      {error ? (
        <Pressable onPress={clearError} style={{ backgroundColor: '#3A1420', padding: theme.space(3), marginHorizontal: theme.space(3), borderRadius: theme.radius.sm }}>
          <Text style={{ color: theme.colors.danger, fontSize: 13 }}>{error} (tap to dismiss)</Text>
        </Pressable>
      ) : null}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: theme.space(3), gap: theme.space(2.5) }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            memHits > 0 ? (
              <Text style={{ color: theme.colors.textDim, fontSize: 11, textAlign: 'center', marginTop: 6 }}>
                Loaded {memHits} relevant {memHits === 1 ? 'memory' : 'memories'} for this turn
              </Text>
            ) : null
          }
          renderItem={({ item }) => <Bubble message={item} streaming={streaming} />}
        />

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: theme.space(2),
            padding: theme.space(3),
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message…"
            placeholderTextColor={theme.colors.textDim}
            multiline
            style={{
              flex: 1,
              color: theme.colors.text,
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.md,
              paddingHorizontal: theme.space(3.5),
              paddingVertical: theme.space(2.5),
              maxHeight: 140,
              fontSize: 15,
            }}
          />
          {streaming ? (
            <Pressable onPress={stop} style={sendBtn('#3A1420')}>
              <Text style={{ color: theme.colors.danger, fontWeight: '700' }}>■</Text>
            </Pressable>
          ) : (
            <Pressable onPress={onSend} style={sendBtn(theme.colors.accent)} disabled={!draft.trim()}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>↑</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>

      <PickerModal
        visible={modal === 'model'}
        title="Provider & model"
        options={modelOptions}
        selected={`${chat.providerId}::${chat.model}`}
        onClose={() => setModal(null)}
        onSelect={(v) => {
          const [pid, model] = v.split('::');
          setChatModel(chat.id, pid as ProviderId, model);
        }}
      />
      <PickerModal
        visible={modal === 'prompt'}
        title="System prompt"
        options={promptOptions}
        selected={chat.systemPromptId ?? ''}
        onClose={() => setModal(null)}
        onSelect={(v) => setSystemPrompt(chat.id, v || null)}
      />
      <PickerModal
        visible={modal === 'compact'}
        title="Compact conversation — keep how much meaning?"
        options={compactOptions}
        selected={String(retentionDefault)}
        onClose={() => setModal(null)}
        onSelect={(v) => compactCurrent(Number(v))}
      />
    </SafeAreaView>
  );
}

function Bubble({ message, streaming }: { message: Message; streaming: boolean }) {
  const isUser = message.role === 'user';
  const empty = !message.content && streaming && message.role === 'assistant';
  return (
    <View
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '88%',
        backgroundColor: isUser ? theme.colors.userBubble : theme.colors.assistantBubble,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingHorizontal: theme.space(3.5),
        paddingVertical: theme.space(2.5),
      }}
    >
      {empty ? (
        <ActivityIndicator color={theme.colors.textDim} />
      ) : (
        <Text style={{ color: theme.colors.text, fontSize: 15, lineHeight: 21 }}>{message.content}</Text>
      )}
      {message.usage?.totalTokens ? (
        <Text style={{ color: theme.colors.textDim, fontSize: 10, marginTop: 4 }}>
          {message.usage.totalTokens} tokens
        </Text>
      ) : null}
    </View>
  );
}

function Chip({ label, onPress, active }: { label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: active ? theme.colors.accentDim : theme.colors.surfaceAlt,
        borderRadius: theme.radius.sm,
        paddingHorizontal: theme.space(3),
        paddingVertical: theme.space(1.5),
      }}
    >
      <Text style={{ color: theme.colors.text, fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

const sendBtn = (bg: string) => ({
  backgroundColor: bg,
  width: 44,
  height: 44,
  borderRadius: 22,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
});
