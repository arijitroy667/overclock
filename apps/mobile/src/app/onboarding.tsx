import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Switch, TextInput, View } from 'react-native';

import { api } from '@/api';
import { radius, space, touch, useTheme } from '@/theme';
import { Button, Card, Screen, T } from '@/ui';

export default function Onboarding() {
  const t = useTheme();
  const [name, setName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [disclaimer, setDisclaimer] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.me().then((me) => setDisclaimer(me.disclaimer)).catch(() => {}); }, []);

  async function finish() {
    try {
      await api.onboard({
        display_name: name.trim() || undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        accept_disclaimer: accepted,
      });
      router.replace('/');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Screen>
      <T kind="title">Welcome to Overclock</T>
      <T>Tools built around how an ADHD brain actually runs: capture fast, start small, let the app hold the clock.</T>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="What should we call you? (optional)"
        placeholderTextColor={t.muted}
        style={{ minHeight: touch, borderRadius: radius, borderWidth: 1, borderColor: t.border, backgroundColor: t.card, color: t.text, paddingHorizontal: space.md, fontSize: 16 }}
      />
      <Card>
        <T kind="h2">Before you start</T>
        <T>{disclaimer}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Switch value={accepted} onValueChange={setAccepted} accessibilityLabel="I understand" />
          <T style={{ flex: 1 }}>I understand</T>
        </View>
      </Card>
      {error && <T kind="muted">{error}</T>}
      <Button label="Let's go" disabled={!accepted} onPress={finish} />
    </Screen>
  );
}
