import { useHostedAuth } from '@clerk/expo/hosted-auth';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';

import { Button, Screen, T } from '@/ui';

WebBrowser.maybeCompleteAuthSession();

export default function SignIn() {
  const { startHostedAuth } = useHostedAuth();
  const [note, setNote] = useState<string | null>(null);

  async function go(mode: 'sign-in' | 'sign-up') {
    setNote(null);
    try {
      const { createdSessionId } = await startHostedAuth({ mode });
      if (!createdSessionId) setNote('No worries, tap again whenever you’re ready.');
    } catch (e) {
      setNote((e as Error).message);
    }
  }

  return (
    <Screen>
      <T kind="title">Overclock</T>
      <T>Run your ADHD brain at its actual clock speed.</T>
      <Button label="Sign in" onPress={() => go('sign-in')} />
      <Button kind="quiet" label="Create an account" onPress={() => go('sign-up')} />
      {note && <T kind="muted">{note}</T>}
    </Screen>
  );
}
