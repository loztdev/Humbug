import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSettings } from '@/state/settings';
import { usePrompts } from '@/state/prompts';
import { useChats } from '@/state/chats';
import { AppLockGate } from '@/components/AppLockGate';
import { theme } from '@/theme';

/** Root layout: bootstraps the local stores once, then renders the nav stack. */
export default function RootLayout() {
  const loadSettings = useSettings((s) => s.load);
  const loadPrompts = usePrompts((s) => s.load);
  const loadChats = useChats((s) => s.loadChats);

  useEffect(() => {
    loadSettings();
    loadPrompts();
    loadChats();
  }, [loadSettings, loadPrompts, loadChats]);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppLockGate>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { color: theme.colors.text },
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Humbug' }} />
        <Stack.Screen name="chat/[id]" options={{ title: 'Chat' }} />
        <Stack.Screen name="settings/index" options={{ title: 'Settings' }} />
        <Stack.Screen name="settings/providers" options={{ title: 'Providers & Keys' }} />
        <Stack.Screen name="settings/prompts" options={{ title: 'System Prompts' }} />
        <Stack.Screen name="settings/memory" options={{ title: 'Memory' }} />
        <Stack.Screen name="search" options={{ title: 'Search' }} />
      </Stack>
      </AppLockGate>
    </SafeAreaProvider>
  );
}
