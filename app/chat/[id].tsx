import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChats } from '@/state/chats';
import { usePrompts } from '@/state/prompts';
import { allProviders, contextWindowFor, costOf, formatCost, priceFor } from '@/providers';
import type { Attachment, Message, ProviderId } from '@/types';
import { PickerModal, type PickerOption } from '@/components/PickerModal';
import { CompactionSheet } from '@/components/CompactionSheet';
import { Markdown } from '@/components/Markdown';
import { pickAttachments, isImage } from '@/files/attachments';
import { exportChat } from '@/export/exporter';
import { useSettings } from '@/state/settings';
import { theme } from '@/theme';

type OpenModal = 'model' | 'prompt' | null;

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
  const regenerateLast = useChats((s) => s.regenerateLast);
  const deleteMessage = useChats((s) => s.deleteMessage);
  const pinMessageToMemory = useChats((s) => s.pinMessageToMemory);
  const truncateFrom = useChats((s) => s.truncateFrom);
  const branchFrom = useChats((s) => s.branchFrom);
  const clearError = useChats((s) => s.clearError);
  const router = useRouter();

  const prompts = usePrompts((s) => s.prompts);
  const retentionDefault = useSettings((s) => s.settings.compactionRetention);

  const [draft, setDraft] = useState('');
  const [modal, setModal] = useState<OpenModal>(null);
  const [compactOpen, setCompactOpen] = useState(false);
  const [pending, setPending] = useState<Attachment[]>([]);
  const [actionMsg, setActionMsg] = useState<Message | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  const chat = useMemo(() => chats.find((c) => c.id === id), [chats, id]);

  useFocusEffect(
    useCallback(() => {
      if (id) openChat(id);
    }, [id, openChat]),
  );

  // Cost + token totals for this chat.
  const totals = useMemo(() => {
    let tokens = 0;
    let cost = 0;
    let known = false;
    if (chat) {
      for (const m of messages) {
        if (m.usage?.totalTokens) tokens += m.usage.totalTokens;
        const c = costOf(chat.providerId, chat.model, m.usage);
        if (c != null) {
          cost += c;
          known = true;
        }
      }
    }
    return { tokens, cost, known };
  }, [messages, chat]);

  // Auto-compact suggestion when nearing the model's context window.
  const contextRatio = useMemo(() => {
    if (!chat) return 0;
    const chars = messages.reduce((n, m) => n + m.content.length, 0);
    const estTokens = chars / 4; // rough heuristic
    return estTokens / contextWindowFor(chat.providerId, chat.model);
  }, [messages, chat]);

  // Rough "cost to send" estimate for the next turn (input tokens only).
  const sendEstimate = useMemo(() => {
    if (!chat) return null;
    const price = priceFor(chat.providerId, chat.model);
    if (!price) return null;
    const chars = messages.reduce((n, m) => n + m.content.length, 0) + draft.length;
    const estTokens = chars / 4;
    if (estTokens < 20) return null;
    return (estTokens / 1_000_000) * price.in;
  }, [messages, draft, chat]);

  const onSend = () => {
    const text = draft.trim();
    if ((!text && pending.length === 0) || streaming) return;
    setDraft('');
    const atts = pending;
    setPending([]);
    send(text, atts);
  };

  const onAttach = async () => {
    const picked = await pickAttachments();
    if (picked.length) setPending((p) => [...p, ...picked]);
  };

  const modelOptions: PickerOption[] = useMemo(
    () =>
      allProviders().flatMap((p) =>
        p.staticModels.map((m) => ({ label: m.label ?? m.id, value: `${p.id}::${m.id}`, sublabel: p.name })),
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

  if (!chat) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  const isLastAssistant =
    actionMsg && messages[messages.length - 1]?.id === actionMsg.id && actionMsg.role === 'assistant';

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
        <Chip label="🗜 Compact" onPress={() => setCompactOpen(true)} />
      </View>

      {totals.tokens > 0 ? (
        <Text style={{ color: theme.colors.textDim, fontSize: 11, paddingHorizontal: theme.space(4), marginTop: -theme.space(1) }}>
          {totals.tokens.toLocaleString()} tokens{totals.known ? ` · ~${formatCost(totals.cost)}` : ''}
        </Text>
      ) : null}

      {contextRatio > 0.7 && !streaming ? (
        <Pressable
          onPress={() => setCompactOpen(true)}
          style={{ backgroundColor: theme.colors.surfaceAlt, marginHorizontal: theme.space(3), marginTop: theme.space(2), borderRadius: theme.radius.sm, padding: theme.space(3), borderWidth: 1, borderColor: theme.colors.accentDim }}
        >
          <Text style={{ color: theme.colors.text, fontSize: 12 }}>
            ⚠️ This chat is at ~{Math.round(contextRatio * 100)}% of the model’s context window. Tap to compact.
          </Text>
        </Pressable>
      ) : null}

      {error ? (
        <Pressable onPress={clearError} style={{ backgroundColor: '#3A1420', padding: theme.space(3), marginHorizontal: theme.space(3), marginTop: theme.space(2), borderRadius: theme.radius.sm }}>
          <Text style={{ color: theme.colors.danger, fontSize: 13 }}>{error} (tap to dismiss)</Text>
        </Pressable>
      ) : null}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
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
          renderItem={({ item }) => (
            <Bubble
              message={item}
              streaming={streaming}
              providerId={chat.providerId}
              model={chat.model}
              onLongPress={() => setActionMsg(item)}
            />
          )}
        />

        {pending.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space(2), paddingHorizontal: theme.space(3), paddingBottom: theme.space(2) }}>
            {pending.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => setPending((p) => p.filter((x) => x.id !== a.id))}
                style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.sm, paddingHorizontal: theme.space(3), paddingVertical: theme.space(1.5) }}
              >
                <Text style={{ color: theme.colors.text, fontSize: 12 }}>
                  {isImage(a.mimeType) ? '🖼' : '📄'} {a.name}  ✕
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {sendEstimate != null ? (
          <Text style={{ color: theme.colors.textDim, fontSize: 10, textAlign: 'right', paddingHorizontal: theme.space(4), paddingBottom: 2 }}>
            ~{formatCost(sendEstimate)} to send
          </Text>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.space(2), padding: theme.space(3), borderTopWidth: 1, borderTopColor: theme.colors.border }}>
          <Pressable onPress={onAttach} style={sendBtn(theme.colors.surfaceAlt)}>
            <Text style={{ color: theme.colors.text, fontSize: 20 }}>＋</Text>
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message…"
            placeholderTextColor={theme.colors.textDim}
            multiline
            style={{ flex: 1, color: theme.colors.text, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, paddingHorizontal: theme.space(3.5), paddingVertical: theme.space(2.5), maxHeight: 140, fontSize: 15 }}
          />
          {streaming ? (
            <Pressable onPress={stop} style={sendBtn('#3A1420')}>
              <Text style={{ color: theme.colors.danger, fontWeight: '700' }}>■</Text>
            </Pressable>
          ) : (
            <Pressable onPress={onSend} style={sendBtn(theme.colors.accent)} disabled={!draft.trim() && pending.length === 0}>
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
      <CompactionSheet
        visible={compactOpen}
        initial={retentionDefault}
        onClose={() => setCompactOpen(false)}
        onConfirm={(r) => compactCurrent(r)}
      />

      {/* Per-message actions */}
      <Modal visible={!!actionMsg} transparent animationType="fade" onRequestClose={() => setActionMsg(null)}>
        <Pressable onPress={() => setActionMsg(null)} style={{ flex: 1, backgroundColor: '#000000AA', justifyContent: 'center', padding: theme.space(6) }}>
          <Pressable style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, overflow: 'hidden' }}>
            <ActionRow
              label="Copy text"
              onPress={async () => {
                if (actionMsg) await Clipboard.setStringAsync(actionMsg.content);
                setActionMsg(null);
              }}
            />
            <ActionRow
              label="📌 Pin to memory"
              onPress={async () => {
                if (actionMsg) await pinMessageToMemory(actionMsg);
                setActionMsg(null);
              }}
            />
            {isLastAssistant ? (
              <ActionRow
                label="↻ Regenerate"
                onPress={() => {
                  setActionMsg(null);
                  regenerateLast();
                }}
              />
            ) : null}
            {actionMsg?.role === 'user' ? (
              <ActionRow
                label="✎ Edit & resend"
                onPress={async () => {
                  const m = actionMsg;
                  setActionMsg(null);
                  if (m) {
                    const text = await truncateFrom(m.id);
                    if (text != null) setDraft(text);
                  }
                }}
              />
            ) : null}
            <ActionRow
              label="⑂ Branch from here"
              onPress={async () => {
                const m = actionMsg;
                setActionMsg(null);
                if (m) {
                  const newId = await branchFrom(m.id);
                  if (newId) router.push(`/chat/${newId}`);
                }
              }}
            />
            <ActionRow
              label="Delete message"
              danger
              onPress={() => {
                if (actionMsg) deleteMessage(actionMsg.id);
                setActionMsg(null);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Bubble({
  message,
  streaming,
  providerId,
  model,
  onLongPress,
}: {
  message: Message;
  streaming: boolean;
  providerId: ProviderId;
  model: string;
  onLongPress: () => void;
}) {
  const isUser = message.role === 'user';
  const empty = !message.content && streaming && message.role === 'assistant';
  const atts = message.attachments ?? [];
  const cost = costOf(providerId, model, message.usage);
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={300}
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '88%',
        backgroundColor: isUser ? theme.colors.userBubble : theme.colors.assistantBubble,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingHorizontal: theme.space(3.5),
        paddingVertical: theme.space(2.5),
        gap: theme.space(2),
      }}
    >
      {atts.length > 0 ? (
        <View style={{ gap: theme.space(1.5) }}>
          {atts.map((a) =>
            isImage(a.mimeType) ? (
              <Image key={a.id} source={{ uri: a.uri }} style={{ width: 180, height: 180, borderRadius: theme.radius.sm }} resizeMode="cover" />
            ) : (
              <Text key={a.id} style={{ color: theme.colors.textDim, fontSize: 12 }}>
                📄 {a.name}
              </Text>
            ),
          )}
        </View>
      ) : null}

      {empty ? (
        <ActivityIndicator color={theme.colors.textDim} />
      ) : message.content ? (
        isUser ? (
          <Text style={{ color: theme.colors.text, fontSize: 15, lineHeight: 22 }}>{message.content}</Text>
        ) : (
          <Markdown value={message.content} />
        )
      ) : null}

      {message.usage?.totalTokens ? (
        <Text style={{ color: theme.colors.textDim, fontSize: 10 }}>
          {message.usage.totalTokens} tokens{cost != null ? ` · ${formatCost(cost)}` : ''}
        </Text>
      ) : null}
    </Pressable>
  );
}

function ActionRow({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={{ padding: theme.space(4), borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
      <Text style={{ color: danger ? theme.colors.danger : theme.colors.text, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

function Chip({ label, onPress, active }: { label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ backgroundColor: active ? theme.colors.accentDim : theme.colors.surfaceAlt, borderRadius: theme.radius.sm, paddingHorizontal: theme.space(3), paddingVertical: theme.space(1.5) }}
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
