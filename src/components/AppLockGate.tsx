import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Pressable, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSettings } from '@/state/settings';
import { theme } from '@/theme';

/**
 * Wraps the app and, when App Lock is enabled, requires device authentication
 * (biometric or device PIN) before the UI is shown — on launch and whenever the
 * app returns to the foreground.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const appLock = useSettings((s) => s.settings.appLock);
  const settingsLoaded = useSettings((s) => s.loaded);
  const [unlocked, setUnlocked] = useState(false);
  const [authing, setAuthing] = useState(false);
  const appState = useRef(AppState.currentState);

  const authenticate = useCallback(async () => {
    if (authing) return;
    setAuthing(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) {
        // Nothing to authenticate against — don't lock the user out.
        setUnlocked(true);
        return;
      }
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Humbug',
        fallbackLabel: 'Use device PIN',
      });
      setUnlocked(res.success);
    } catch {
      setUnlocked(false);
    } finally {
      setAuthing(false);
    }
  }, [authing]);

  // Prompt once settings are loaded and lock is on.
  useEffect(() => {
    if (settingsLoaded && appLock && !unlocked) authenticate();
    if (!appLock) setUnlocked(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded, appLock]);

  // Re-lock when returning to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        if (appLock) setUnlocked(false);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [appLock]);

  if (appLock && !unlocked) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center', gap: theme.space(4) }}>
        <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: '800' }}>Humbug is locked</Text>
        <Pressable
          onPress={authenticate}
          style={{ backgroundColor: theme.colors.accent, borderRadius: theme.radius.md, paddingHorizontal: theme.space(6), paddingVertical: theme.space(3) }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>{authing ? 'Authenticating…' : 'Unlock'}</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}
