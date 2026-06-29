import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSettings } from '@/state/settings';
import { allProviders } from '@/providers';
import { getApiKey } from '@/storage/secureKeys';
import type { ProviderId } from '@/types';
import { theme } from '@/theme';

/**
 * API key management. Keys are written to the OS keystore; we only display
 * whether one is set (masked), never echo the stored value back in full.
 */
export default function ProvidersScreen() {
  const keyPresence = useSettings((s) => s.keyPresence);
  const saveKey = useSettings((s) => s.saveKey);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: theme.space(3), gap: theme.space(3) }}>
      <Text style={{ color: theme.colors.textDim, fontSize: 13, lineHeight: 19, marginBottom: theme.space(1) }}>
        Bring your own key. Keys are stored only on this device, in the secure
        keystore. Connect as many providers as you like.
      </Text>
      {allProviders().map((p) => (
        <ProviderCard
          key={p.id}
          id={p.id}
          name={p.name}
          embeddings={p.capabilities.embeddings}
          hasKey={keyPresence[p.id]}
          onSave={(k) => saveKey(p.id, k)}
        />
      ))}
    </ScrollView>
  );
}

function ProviderCard({
  id,
  name,
  embeddings,
  hasKey,
  onSave,
}: {
  id: ProviderId;
  name: string;
  embeddings: boolean;
  hasKey: boolean;
  onSave: (key: string) => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  // Prefill the field when editing so users can review/replace the key.
  useEffect(() => {
    if (editing) getApiKey(id).then((k) => setValue(k ?? ''));
  }, [editing, id]);

  const save = async () => {
    await onSave(value.trim());
    setSaved(true);
    setEditing(false);
    setValue('');
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: theme.space(4) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600' }}>{name}</Text>
        <Text style={{ color: hasKey ? theme.colors.success : theme.colors.textDim, fontSize: 12 }}>
          {saved ? 'Saved ✓' : hasKey ? '● connected' : '○ no key'}
        </Text>
      </View>
      <Text style={{ color: theme.colors.textDim, fontSize: 11, marginTop: 2 }}>
        {embeddings ? 'Chat + embeddings' : 'Chat only'}
      </Text>

      {editing ? (
        <View style={{ marginTop: theme.space(3), gap: theme.space(2) }}>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="Paste API key"
            placeholderTextColor={theme.colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={{
              color: theme.colors.text,
              backgroundColor: theme.colors.surfaceAlt,
              borderRadius: theme.radius.sm,
              padding: theme.space(3),
              fontSize: 14,
            }}
          />
          <View style={{ flexDirection: 'row', gap: theme.space(2) }}>
            <Pressable onPress={save} style={{ flex: 1, backgroundColor: theme.colors.accent, borderRadius: theme.radius.sm, padding: theme.space(3), alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
            </Pressable>
            <Pressable onPress={() => { setEditing(false); setValue(''); }} style={{ paddingHorizontal: theme.space(4), justifyContent: 'center' }}>
              <Text style={{ color: theme.colors.textDim }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setEditing(true)} style={{ marginTop: theme.space(3) }}>
          <Text style={{ color: theme.colors.accent, fontSize: 14 }}>
            {hasKey ? 'Replace key' : 'Add key'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
