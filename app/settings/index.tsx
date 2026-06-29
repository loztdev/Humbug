import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { useSettings } from '@/state/settings';
import { useChats } from '@/state/chats';
import { usePrompts } from '@/state/prompts';
import { allProviders, embeddingProviders, getProvider } from '@/providers';
import { PickerModal } from '@/components/PickerModal';
import { CompactionSheet } from '@/components/CompactionSheet';
import { createEncryptedBackup, restoreEncryptedBackup } from '@/backup/backup';
import type { ProviderId } from '@/types';
import { theme } from '@/theme';

type Open = 'chatProvider' | 'chatModel' | 'embProvider' | null;

export default function SettingsScreen() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const reloadSettings = useSettings((s) => s.load);
  const reloadChats = useChats((s) => s.loadChats);
  const reloadPrompts = usePrompts((s) => s.load);
  const [open, setOpen] = useState<Open>(null);
  const [retentionSheet, setRetentionSheet] = useState(false);

  const [backupMode, setBackupMode] = useState<'backup' | 'restore' | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);

  const chatProvider = getProvider(settings.chatProviderId);

  const runBackup = async () => {
    if (busy) return;
    const pass = passphrase;
    setBusy(true);
    try {
      if (backupMode === 'backup') {
        await createEncryptedBackup(pass);
        Alert.alert('Backup created', 'Your encrypted backup is ready to save or share.');
      } else {
        const r = await restoreEncryptedBackup(pass);
        if (r) {
          await Promise.all([reloadSettings(), reloadChats(), reloadPrompts()]);
          Alert.alert('Restored', `${r.chats} chats, ${r.messages} messages, ${r.memories} memories.`);
        }
      }
      setBackupMode(null);
      setPassphrase('');
    } catch (e) {
      Alert.alert('Failed', (e as Error)?.message ?? 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: theme.space(3), gap: theme.space(3) }}>
      <Section title="Chat">
        <Row label="Provider" value={chatProvider.name} onPress={() => setOpen('chatProvider')} />
        <Row label="Model" value={settings.chatModel} onPress={() => setOpen('chatModel')} />
      </Section>

      <Section title="Memory (embeddings)">
        <Row
          label="Embeddings provider"
          value={settings.embeddingProviderId ? getProvider(settings.embeddingProviderId).name : 'Disabled'}
          onPress={() => setOpen('embProvider')}
        />
        <Text style={{ color: theme.colors.textDim, fontSize: 12, paddingHorizontal: theme.space(4), paddingBottom: theme.space(3) }}>
          Semantic memory needs an embeddings-capable provider (OpenAI, Gemini, or z.ai). Anthropic and OpenRouter don’t offer embeddings.
        </Text>
      </Section>

      <Section title="Compaction">
        <Row
          label="Default meaning kept"
          value={`${Math.round(settings.compactionRetention * 100)}%`}
          onPress={() => setRetentionSheet(true)}
        />
      </Section>

      <Section title="Security">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.space(3.5) }}>
          <View style={{ flex: 1, paddingRight: theme.space(3) }}>
            <Text style={{ color: theme.colors.text, fontSize: 15 }}>App lock</Text>
            <Text style={{ color: theme.colors.textDim, fontSize: 12, marginTop: 2 }}>
              Require biometrics / device PIN to open Humbug.
            </Text>
          </View>
          <Switch
            value={settings.appLock}
            onValueChange={(v) => update({ appLock: v })}
            trackColor={{ true: theme.colors.accentDim, false: theme.colors.border }}
            thumbColor={settings.appLock ? theme.colors.accent : '#888'}
          />
        </View>
      </Section>

      <Section title="Backup">
        <Row label="Create encrypted backup" value="" onPress={() => { setPassphrase(''); setBackupMode('backup'); }} />
        <Row label="Restore from backup" value="" onPress={() => { setPassphrase(''); setBackupMode('restore'); }} />
        <Text style={{ color: theme.colors.textDim, fontSize: 12, paddingHorizontal: theme.space(4), paddingBottom: theme.space(3) }}>
          Encrypts chats, memories, and prompts with your passphrase. API keys are not included — they stay in the device keystore.
        </Text>
      </Section>

      <Section title="Manage">
        <LinkRow href="/settings/providers" label="Providers & API keys" />
        <LinkRow href="/settings/prompts" label="System prompt library" />
        <LinkRow href="/settings/memory" label="Memory browser" />
      </Section>

      <PickerModal
        visible={open === 'chatProvider'}
        title="Chat provider"
        selected={settings.chatProviderId}
        options={allProviders().map((p) => ({ label: p.name, value: p.id }))}
        onClose={() => setOpen(null)}
        onSelect={(v) => {
          const p = getProvider(v as ProviderId);
          update({ chatProviderId: p.id, chatModel: p.defaultModel });
        }}
      />
      <PickerModal
        visible={open === 'chatModel'}
        title="Chat model"
        selected={settings.chatModel}
        options={chatProvider.staticModels.map((m) => ({ label: m.label ?? m.id, value: m.id }))}
        onClose={() => setOpen(null)}
        onSelect={(v) => update({ chatModel: v })}
      />
      <PickerModal
        visible={open === 'embProvider'}
        title="Embeddings provider"
        selected={settings.embeddingProviderId ?? ''}
        options={[
          { label: 'Disabled', value: '' },
          ...embeddingProviders().map((p) => ({ label: p.name, value: p.id })),
        ]}
        onClose={() => setOpen(null)}
        onSelect={(v) =>
          update({
            embeddingProviderId: (v || null) as ProviderId | null,
            embeddingModel: v ? getProvider(v as ProviderId).defaultEmbeddingModel ?? null : null,
          })
        }
      />
      <CompactionSheet
        visible={retentionSheet}
        initial={settings.compactionRetention}
        title="Default compaction level"
        confirmLabel="Save default"
        onConfirm={(r) => update({ compactionRetention: r })}
        onClose={() => setRetentionSheet(false)}
      />

      <Modal visible={backupMode !== null} transparent animationType="fade" onRequestClose={() => setBackupMode(null)}>
        <Pressable onPress={() => setBackupMode(null)} style={{ flex: 1, backgroundColor: '#000000AA', justifyContent: 'center', padding: theme.space(6) }}>
          <Pressable style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.space(5), gap: theme.space(3) }}>
            <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700' }}>
              {backupMode === 'backup' ? 'Create encrypted backup' : 'Restore from backup'}
            </Text>
            <Text style={{ color: theme.colors.textDim, fontSize: 13 }}>
              {backupMode === 'backup'
                ? 'Choose a passphrase. You’ll need it to restore — it can’t be recovered.'
                : 'Enter the passphrase used to create the backup, then pick the file.'}
            </Text>
            <TextInput
              value={passphrase}
              onChangeText={setPassphrase}
              placeholder="Passphrase"
              placeholderTextColor={theme.colors.textDim}
              secureTextEntry
              autoCapitalize="none"
              style={{ color: theme.colors.text, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.sm, padding: theme.space(3), fontSize: 15 }}
            />
            <Pressable
              onPress={runBackup}
              disabled={busy || passphrase.length < 4}
              style={{ backgroundColor: passphrase.length < 4 ? theme.colors.surfaceAlt : theme.colors.accent, borderRadius: theme.radius.md, padding: theme.space(3.5), alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>
                {busy ? 'Working…' : backupMode === 'backup' ? 'Create backup' : 'Choose file & restore'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={{ color: theme.colors.textDim, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: theme.space(1.5), marginLeft: theme.space(1) }}>
        {title}
      </Text>
      <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
}

function Row({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.space(3.5) }}
    >
      <Text style={{ color: theme.colors.text, fontSize: 15 }}>{label}</Text>
      <Text style={{ color: theme.colors.accent, fontSize: 14 }}>{value ? `${value} ›` : '›'}</Text>
    </Pressable>
  );
}

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable style={{ flexDirection: 'row', justifyContent: 'space-between', padding: theme.space(3.5) }}>
        <Text style={{ color: theme.colors.text, fontSize: 15 }}>{label}</Text>
        <Text style={{ color: theme.colors.accent }}>›</Text>
      </Pressable>
    </Link>
  );
}
