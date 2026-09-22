import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { api } from '@/api';
import { space } from '@/theme';
import { Button, Card, Screen, T } from '@/ui';

const LEVELS = [
  [1, 'Running on fumes'],
  [2, 'Low'],
  [3, 'Okay'],
  [4, 'Good'],
  [5, 'Charged up'],
] as const;

export default function Energy() {
  const [note, setNote] = useState<string | null>(null);

  async function pick(level: number) {
    try {
      await api.logEnergy(level);
      router.navigate({ pathname: '/', params: { energy: String(level) } });
    } catch {
      setNote("Couldn't save that one. Try again in a moment.");
    }
  }

  return (
    <Screen>
      <T kind="title">How’s your energy?</T>
      <T kind="muted">No right answer. We’ll show tasks that fit how you feel right now.</T>
      <Card>
        <View style={{ gap: space.sm }}>
          {LEVELS.map(([level, label]) => (
            <Button key={level} kind="quiet" label={`${level} · ${label}`} onPress={() => pick(level)} />
          ))}
        </View>
      </Card>
      {note && <T kind="muted">{note}</T>}
    </Screen>
  );
}
