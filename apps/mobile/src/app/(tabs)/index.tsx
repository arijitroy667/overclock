import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { TextInput, View } from 'react-native';

import { api, capture, isReframing, Task } from '@/api';
import { radius, space, touch, useTheme } from '@/theme';
import { Button, Card, Screen, T } from '@/ui';

export default function Now() {
  const t = useTheme();
  const { energy } = useLocalSearchParams<{ energy?: string }>();
  const [text, setText] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [resurfaced, setResurfaced] = useState<Task[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.tasks(energy ? Number(energy) : undefined).then(setTasks).catch(() => setNote("Can't reach Overclock right now. Captures still save."));
    api.resurface().then(setResurfaced).catch(() => {});
  }, [energy]);
  useFocusEffect(load);

  async function submit() {
    const value = text.trim();
    if (!value) return;
    setBusy(true);
    setText('');
    try {
      const task = await capture(value);
      setNote(task ? null : "Saved on this phone. It'll sync when you're back online.");
      load();
      [4000, 10000].forEach((ms) => setTimeout(load, ms)); // pick up the background reframe
    } catch (e) {
      setText(value); // never drop what they typed
      setNote(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  const resurfacedIds = new Set(resurfaced.map((r) => r.id));
  return (
    <Screen>
      <T kind="title">What’s on your mind?</T>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={submit}
          placeholder="Type it, or tap the keyboard mic to say it"
          placeholderTextColor={t.muted}
          returnKeyType="done"
          accessibilityLabel="Capture a thought"
          style={{
            flex: 1, minHeight: touch, borderRadius: radius, borderWidth: 1, borderColor: t.border,
            backgroundColor: t.card, color: t.text, paddingHorizontal: space.md, fontSize: 16,
          }}
        />
        <Button label={busy ? '…' : 'Add'} onPress={submit} disabled={busy} />
      </View>
      {note && <T kind="muted">{note}</T>}

      {energy && (
        <Card style={{ backgroundColor: t.soft }}>
          <T>Showing what fits energy {energy}/5.</T>
          <Button kind="quiet" label="Show everything" onPress={() => router.setParams({ energy: undefined })} />
        </Card>
      )}

      {resurfaced.length > 0 && <T kind="h2">From a few days ago</T>}
      {resurfaced.map((task) => <TaskCard key={task.id} task={task} onChange={load} />)}

      {tasks.filter((x) => !resurfacedIds.has(x.id)).length > 0 && <T kind="h2">Up next</T>}
      {tasks.filter((x) => !resurfacedIds.has(x.id)).map((task) => <TaskCard key={task.id} task={task} onChange={load} />)}
    </Screen>
  );
}

function TaskCard({ task, onChange }: { task: Task; onChange: () => void }) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [busy, setBusy] = useState(false);
  const reframed = !!task.reframed_title;

  async function start() {
    if (reframed) await api.patch(task.id, { reframe_accepted: true }).catch(() => {});
    router.push({
      pathname: '/focus',
      params: { id: task.id, title: task.reframed_title ?? task.raw_input_text, minutes: String(task.estimated_duration_padded ?? 25) },
    });
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); onChange(); } finally { setBusy(false); }
  }

  return (
    <Card>
      <T kind="h2">{showOriginal || !reframed ? task.raw_input_text : task.reframed_title}</T>
      {task.first_step && <T>First step: {task.first_step}</T>}
      {isReframing(task) && <T kind="muted">Finding a better angle…</T>}
      <T kind="muted">
        {[task.estimated_duration_padded && `~${task.estimated_duration_padded} min`, task.due_at && `due ${new Date(task.due_at).toLocaleDateString()}`]
          .filter(Boolean).join(' · ')}
      </T>
      <Button label="Start" onPress={start} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button kind="quiet" label="Another angle" disabled={busy} onPress={() => run(() => api.reframe(task.id))} />
        </View>
        <View style={{ flex: 1 }}>
          <Button kind="quiet" label="Done" disabled={busy} onPress={() => run(() => api.complete(task.id))} />
        </View>
      </View>
      {reframed && (
        <T kind="muted" onPress={() => setShowOriginal(!showOriginal)} accessibilityRole="button">
          {showOriginal ? 'Show reframed' : 'Show what I wrote'}
        </T>
      )}
    </Card>
  );
}
