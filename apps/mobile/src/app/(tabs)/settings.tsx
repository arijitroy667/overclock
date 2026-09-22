import { useAuth, useUser } from '@clerk/expo';
import { useEffect, useState } from 'react';
import { Share, TextInput } from 'react-native';

import { api } from '@/api';
import { radius, space, touch, useTheme } from '@/theme';
import { Button, Card, Screen, T } from '@/ui';

export default function Settings() {
  const t = useTheme();
  const { signOut } = useAuth();
  const { user } = useUser();
  const [disclaimer, setDisclaimer] = useState('');
  const [confirm, setConfirm] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.me().then((me) => setDisclaimer(me.disclaimer)).catch(() => {}); }, []);

  async function exportData() {
    try {
      await Share.share({ title: 'Overclock export', message: JSON.stringify(await api.exportData(), null, 2) });
    } catch (e) {
      setNote((e as Error).message);
    }
  }

  async function deleteAccount() {
    setBusy(true);
    try {
      await api.deleteAccount(); // Overclock data first, so nothing is orphaned if the next step fails
      await user?.delete();
      await signOut();
    } catch (e) {
      setNote(`Your Overclock data is deleted, but removing the sign-in failed: ${(e as Error).message}`);
      setBusy(false);
    }
  }

  return (
    <Screen>
      <T kind="title">Settings</T>
      <Card>
        <T kind="h2">What Overclock is (and isn’t)</T>
        <T>{disclaimer}</T>
        <T kind="muted">If things feel heavier than a tool can help with, please reach out to a doctor or a mental health professional.</T>
      </Card>
      <Card>
        <T kind="h2">Your data</T>
        <T kind="muted">Everything you’ve captured, logged and finished, as JSON.</T>
        <Button kind="quiet" label="Export my data" onPress={exportData} />
      </Card>
      <Card>
        <T kind="h2">Delete account</T>
        <T kind="muted">Permanently removes your tasks, sessions, energy logs and sign-in. This can’t be undone. Type “delete” to confirm.</T>
        <TextInput
          value={confirm}
          onChangeText={setConfirm}
          autoCapitalize="none"
          accessibilityLabel="Type delete to confirm"
          style={{ minHeight: touch, borderRadius: radius, borderWidth: 1, borderColor: t.border, color: t.text, paddingHorizontal: space.md }}
        />
        <Button
          kind="quiet"
          label={busy ? 'Deleting…' : 'Delete my account'}
          disabled={confirm.trim().toLowerCase() !== 'delete' || busy}
          onPress={deleteAccount}
        />
      </Card>
      <Button kind="quiet" label="Sign out" onPress={() => signOut()} />
      {note && <T kind="muted">{note}</T>}
    </Screen>
  );
}
