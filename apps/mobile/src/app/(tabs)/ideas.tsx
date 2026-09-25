import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { TextInput, View } from 'react-native';

import { api, Idea } from '@/api';
import { radius, space, touch, useTheme } from '@/theme';
import { Button, Card, Screen, T } from '@/ui';

export default function Ideas() {
  const t = useTheme();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => { api.ideas().then(setIdeas).catch(() => {}); }, []);
  useFocusEffect(load);

  async function add() {
    const value = text.trim();
    if (!value) return;
    setText('');
    try {
      setIdeas([await api.addIdea(value), ...ideas]);
    } catch (e) {
      setText(value);
      setNote((e as Error).message);
    }
  }

  async function run(fn: () => Promise<unknown>, said: string) {
    try {
      await fn();
      setNote(said);
      load();
    } catch (e) {
      setNote((e as Error).message);
    }
  }

  return (
    <Screen>
      <T kind="title">Idea vault</T>
      <T kind="muted">Park the thoughts that show up mid-task. Nothing here nags you.</T>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={add}
          placeholder="Park an idea…"
          placeholderTextColor={t.muted}
          returnKeyType="done"
          accessibilityLabel="Park an idea"
          style={{
            flex: 1, minHeight: touch, borderRadius: radius, borderWidth: 1, borderColor: t.border,
            backgroundColor: t.card, color: t.text, paddingHorizontal: space.md, fontSize: 16, fontFamily: t.font,
          }}
        />
        <Button label="Park it" onPress={add} />
      </View>
      {note && <T kind="muted">{note}</T>}
      {ideas.length === 0 && <T kind="muted">Empty for now. That is a perfectly good state.</T>}
      {ideas.map((idea) => (
        <Card key={idea.id}>
          <T>{idea.text}</T>
          <T kind="muted">{new Date(idea.created_at).toLocaleDateString()}</T>
          <Button kind="quiet" label="Make it a task" onPress={() => run(() => api.promoteIdea(idea.id), 'Added to your tasks.')} />
          <Button kind="quiet" label="Let it go" onPress={() => run(() => api.archiveIdea(idea.id), 'Tucked away.')} />
        </Card>
      ))}
    </Screen>
  );
}
