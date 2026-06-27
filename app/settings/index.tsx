import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useSettings } from '@/state/settings';
import { allProviders, embeddingProviders, getProvider } from '@/providers';
import { PickerModal, type PickerOption } from '@/components/PickerModal';
import { gainsAssessment, RETENTION } from '@/compaction/compactor';
import type { ProviderId } from '@/types';
import { theme } from '@/theme';

type Open = 'chatProvider' | 'chatModel' | 'embProvider' | 'retention' | null;
const RETENTION_STEPS = [0.5, 0.6, 0.7, 0.8, 0.9, RETENTION.max];

export default function SettingsScreen() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const [open, setOpen] = useState<Open>(null);

  const chatProvider = getProvider(settings.chatProviderId);

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
          onPress={() => setOpen('retention')}
        />
      </Section>

      <Section title="Manage">
        <LinkRow href="/settings/providers" label="Providers & API keys" />
        <LinkRow href="/settings/prompts" label="System prompt library" />
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
      <PickerModal
        visible={open === 'retention'}
        title="Default compaction — keep how much meaning?"
        selected={String(settings.compactionRetention)}
        options={RETENTION_STEPS.map((r): PickerOption => ({
          label: `${Math.round(r * 100)}%`,
          value: String(r),
          sublabel: gainsAssessment(r).message,
        }))}
        onClose={() => setOpen(null)}
        onSelect={(v) => update({ compactionRetention: Number(v) })}
      />
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
      <Text style={{ color: theme.colors.accent, fontSize: 14 }}>{value} ›</Text>
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
