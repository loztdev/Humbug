import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Slider } from './Slider';
import { gainsAssessment, RETENTION } from '@/compaction/retention';
import { theme } from '@/theme';

/**
 * Bottom sheet for choosing a meaning-retention level on a continuous slider,
 * with a live, honest gains explainer. Used both to run compaction and to set
 * the default in Settings.
 */
export function CompactionSheet({
  visible,
  initial,
  title = 'Compact — keep how much meaning?',
  confirmLabel = 'Compact',
  onConfirm,
  onClose,
}: {
  visible: boolean;
  initial: number;
  title?: string;
  confirmLabel?: string;
  onConfirm: (retention: number) => void;
  onClose: () => void;
}) {
  const [r, setR] = useState(initial);
  useEffect(() => {
    if (visible) setR(initial);
  }, [visible, initial]);

  const g = gainsAssessment(r);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' }}
      >
        <Pressable
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radius.lg,
            borderTopRightRadius: theme.radius.lg,
            padding: theme.space(5),
            paddingBottom: theme.space(8),
            gap: theme.space(3),
          }}
        >
          <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700' }}>{title}</Text>

          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.accent, fontSize: 34, fontWeight: '800' }}>
              {Math.round(r * 100)}%
            </Text>
            <Text style={{ color: theme.colors.textDim, fontSize: 13 }}>
              ~{Math.round(g.estimatedReduction * 100)}% smaller
            </Text>
          </View>

          <Slider value={r} min={RETENTION.min} max={RETENTION.max} step={0.01} onChange={setR} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.textDim, fontSize: 11 }}>50% · max savings</Text>
            <Text style={{ color: theme.colors.textDim, fontSize: 11 }}>97% · max fidelity</Text>
          </View>

          <Text style={{ color: g.worthwhile ? theme.colors.textDim : theme.colors.danger, fontSize: 13, lineHeight: 19 }}>
            {g.message}
          </Text>

          <Pressable
            onPress={() => {
              onConfirm(r);
              onClose();
            }}
            style={{
              backgroundColor: theme.colors.accent,
              borderRadius: theme.radius.md,
              padding: theme.space(3.5),
              alignItems: 'center',
              marginTop: theme.space(1),
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{confirmLabel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
