import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { allProviders, getProvider } from '@/providers';
import { getApiKey } from '@/storage/secureKeys';
import type { ProviderId } from '@/types';
import { PickerModal, type PickerOption } from '@/components/PickerModal';
import { Markdown } from '@/components/Markdown';
import { theme } from '@/theme';

interface Panel {
  text: string;
  done: boolean;
  error?: string;
}

/**
 * Multi-model "council": send one prompt to up to three provider/model combos
 * at once and compare their answers side by side.
 */
export default function CouncilScreen() {
  const [prompt, setPrompt] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [results, setResults] = useState<Record<string, Panel>>({});
  const [running, setRunning] = useState(false);
  const [picker, setPicker] = useState(false);
  const controllers = useRef<AbortController[]>([]);

  const modelOptions: PickerOption[] = useMemo(
    () =>
      allProviders().flatMap((p) =>
        p.staticModels.map((m) => ({ label: m.label ?? m.id, value: `${p.id}::${m.id}`, sublabel: p.name })),
      ),
    [],
  );

  const addModel = (v: string) => {
    setSelected((s) => (s.includes(v) || s.length >= 3 ? s : [...s, v]));
  };

  const stop = () => {
    controllers.current.forEach((c) => c.abort());
    controllers.current = [];
    setRunning(false);
  };

  const run = async () => {
    if (running || !prompt.trim() || selected.length === 0) return;
    setResults(Object.fromEntries(selected.map((k) => [k, { text: '', done: false }])));
    setRunning(true);
    controllers.current = selected.map(() => new AbortController());

    await Promise.all(
      selected.map(async (key, i) => {
        const [pid, model] = key.split('::');
        const providerId = pid as ProviderId;
        try {
          let apiKey = await getApiKey(providerId);
          if (apiKey == null) apiKey = providerId === 'custom' ? '' : null;
          if (apiKey == null) {
            setResults((r) => ({ ...r, [key]: { ...r[key], error: 'No API key set', done: true } }));
            return;
          }
          for await (const chunk of getProvider(providerId).streamChat(
            { model, messages: [{ role: 'user', content: prompt.trim() }] },
            apiKey,
            controllers.current[i].signal,
          )) {
            if (chunk.delta) {
              setResults((r) => ({ ...r, [key]: { ...r[key], text: (r[key]?.text ?? '') + chunk.delta } }));
            }
            if (chunk.done) break;
          }
          setResults((r) => ({ ...r, [key]: { ...r[key], done: true } }));
        } catch (e) {
          setResults((r) => ({ ...r, [key]: { ...r[key], error: (e as Error)?.message ?? 'Failed', done: true } }));
        }
      }),
    );
    setRunning(false);
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <Stack.Screen options={{ title: 'Council' }} />

      <View style={{ padding: theme.space(3), gap: theme.space(2) }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space(2) }}>
          {selected.map((k) => (
            <Pressable
              key={k}
              onPress={() => setSelected((s) => s.filter((x) => x !== k))}
              style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.sm, paddingHorizontal: theme.space(3), paddingVertical: theme.space(1.5) }}
            >
              <Text style={{ color: theme.colors.text, fontSize: 12 }}>{k.split('::')[1]}  ✕</Text>
            </Pressable>
          ))}
          {selected.length < 3 ? (
            <Pressable onPress={() => setPicker(true)} style={{ backgroundColor: theme.colors.accentDim, borderRadius: theme.radius.sm, paddingHorizontal: theme.space(3), paddingVertical: theme.space(1.5) }}>
              <Text style={{ color: '#fff', fontSize: 12 }}>+ Add model</Text>
            </Pressable>
          ) : null}
        </View>

        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Ask all selected models the same thing…"
          placeholderTextColor={theme.colors.textDim}
          multiline
          style={{ color: theme.colors.text, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: theme.space(3), fontSize: 15, minHeight: 70, textAlignVertical: 'top', borderWidth: 1, borderColor: theme.colors.border }}
        />
        <Pressable
          onPress={running ? stop : run}
          disabled={!running && (!prompt.trim() || selected.length === 0)}
          style={{ backgroundColor: running ? '#3A1420' : theme.colors.accent, borderRadius: theme.radius.md, padding: theme.space(3.5), alignItems: 'center' }}
        >
          <Text style={{ color: running ? theme.colors.danger : '#fff', fontWeight: '700' }}>
            {running ? 'Stop' : `Ask ${selected.length || ''} model${selected.length === 1 ? '' : 's'}`}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.space(3), gap: theme.space(3) }}>
        {selected.length === 0 ? (
          <Text style={{ color: theme.colors.textDim, textAlign: 'center', padding: theme.space(8) }}>
            Add 2–3 models, type a prompt, and compare their answers side by side.
          </Text>
        ) : null}
        {selected.map((k) => {
          const panel = results[k];
          const [pid, model] = k.split('::');
          return (
            <View key={k} style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: theme.space(3.5) }}>
              <Text style={{ color: theme.colors.accent, fontSize: 12, marginBottom: theme.space(2) }}>
                {getProvider(pid as ProviderId).name} · {model}
              </Text>
              {panel?.error ? (
                <Text style={{ color: theme.colors.danger, fontSize: 13 }}>⚠️ {panel.error}</Text>
              ) : panel?.text ? (
                <Markdown value={panel.text} />
              ) : (
                <Text style={{ color: theme.colors.textDim, fontSize: 13 }}>{running ? 'Thinking…' : '—'}</Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      <PickerModal
        visible={picker}
        title="Add a model to the council"
        options={modelOptions}
        onClose={() => setPicker(false)}
        onSelect={addModel}
      />
    </SafeAreaView>
  );
}
