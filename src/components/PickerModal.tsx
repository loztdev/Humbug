import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { theme } from '@/theme';

/** A simple bottom-sheet-style single-select picker used across screens. */

export interface PickerOption {
  label: string;
  value: string;
  sublabel?: string;
}

export function PickerModal({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selected?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
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
            paddingBottom: theme.space(8),
            maxHeight: '70%',
          }}
        >
          <Text
            style={{
              color: theme.colors.text,
              fontSize: 16,
              fontWeight: '700',
              padding: theme.space(4),
            }}
          >
            {title}
          </Text>
          <ScrollView>
            {options.map((opt) => {
              const active = opt.value === selected;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    onSelect(opt.value);
                    onClose();
                  }}
                  style={{
                    paddingHorizontal: theme.space(4),
                    paddingVertical: theme.space(3.5),
                    backgroundColor: active ? theme.colors.surfaceAlt : 'transparent',
                    borderLeftWidth: 3,
                    borderLeftColor: active ? theme.colors.accent : 'transparent',
                  }}
                >
                  <Text style={{ color: theme.colors.text, fontSize: 15 }}>{opt.label}</Text>
                  {opt.sublabel ? (
                    <Text style={{ color: theme.colors.textDim, fontSize: 12, marginTop: 2 }}>
                      {opt.sublabel}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
