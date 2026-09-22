import { useAuth, useUser } from '@clerk/expo';
import { useEffect, useState } from 'react';
import { Share, Switch, TextInput, View } from 'react-native';

import { api, Preferences } from '@/api';
import { usePrefs } from '@/prefs';
import { radius, space, touch, useTheme } from '@/theme';
import { Button, Card, Screen, T } from '@/ui';

const REMINDER_PRESETS = [[15, 10, 5], [30, 15, 5], [10, 5], [5]];

export default function Settings() {
  const t = useTheme();
  const { prefs, update } = usePrefs();
  const { signOut } = useAuth();
  const { user } = useUser();
  const [disclaimer, setDisclaimer] = useState('');
  const [confirm, setConfirm] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.me().then((me) => setDisclaimer(me.disclaimer)).catch(() => {}); }, []);

  async function change(c: Partial<Preferences>) {
    try { await update(c); } catch (e) { setNote(`Couldn’t save that: ${(e as Error).message}`); }
  }

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
        <T kind="h2">Comfort</T>
        <Toggle label="Calm mode" hint="Quieter colors, no motion." value={prefs.calm_mode} onChange={(v) => change({ calm_mode: v })} />
        <Toggle label="Easier-to-read font" hint="Lexend, with more line spacing." value={prefs.dyslexia_font} onChange={(v) => change({ dyslexia_font: v })} />
      </Card>
      <Card>
        <T kind="h2">Heads-up before time runs out</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {REMINDER_PRESETS.map((preset) => (
            <Button
              key={preset.join()}
              kind={preset.join() === prefs.reminder_offsets.join() ? 'primary' : 'quiet'}
              label={`${preset.join(' · ')} min`}
              onPress={() => change({ reminder_offsets: preset })}
            />
          ))}
        </View>
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

function Toggle({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touch }}>
      <View style={{ flex: 1 }}>
        <T>{label}</T>
        <T kind="muted">{hint}</T>
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}
