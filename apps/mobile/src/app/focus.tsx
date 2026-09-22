import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Modal, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { api } from '@/api';
import { Notifications, notifyIn } from '@/notifications';
import { usePrefs } from '@/prefs';
import { space, useTheme } from '@/theme';
import { Button, Card, Screen, T } from '@/ui';

const GUARDRAIL_REPEAT_MIN = 30; // escalate: after the first check-in, ask again every 30 min

export default function Focus() {
  const t = useTheme();
  const { id, title, minutes } = useLocalSearchParams<{ id: string; title: string; minutes: string }>();
  const total = Number(minutes) || 25;
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [guardrailAt, setGuardrailAt] = useState(120);
  const [inFlow, setInFlow] = useState(false);
  const transitionIds = useRef<string[]>([]);
  const { prefs } = usePrefs();
  const offsets = prefs.reminder_offsets;

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    let cancelled = false;
    (async () => {
      const session = await api.startSession(id).catch(() => null);
      if (cancelled || !session) return;
      setSessionId(session.id);
      setGuardrailAt(session.guardrail_after_minutes);
      if (!Notifications || !(await Notifications.requestPermissionsAsync()).granted) return;
      const ids = await Promise.all([
        ...offsets.filter((w) => w < total).map((w) => notifyIn(total - w, `${w} minutes left`, title)),
        notifyIn(total, "Time's up", 'Wrap up or keep going. Your call.'),
      ]);
      transitionIds.current = ids.filter((x): x is string => x !== null);
      // Guardrails stay on even in flow: hyperfocus is exactly when you skip water and food.
      for (let i = 0; i < 3; i++) {
        notifyIn(session.guardrail_after_minutes + i * GUARDRAIL_REPEAT_MIN, 'Quick body check', 'Water, stretch, food? Your work will wait a minute.');
      }
    })();
    return () => {
      cancelled = true;
      clearInterval(tick);
      Notifications?.cancelAllScheduledNotificationsAsync();
    };
  }, [id, title, total]); // eslint-disable-line react-hooks/exhaustive-deps -- schedule once per visit

  const elapsedMin = (now - startedAt) / 60000;
  const remaining = total - elapsedMin;
  const fraction = Math.max(0, remaining / total);
  const mm = Math.floor(Math.abs(remaining));
  const ss = Math.floor((Math.abs(remaining) * 60) % 60).toString().padStart(2, '0');

  async function enterFlow() {
    setInFlow(true); // defer non-urgent nudges, keep guardrails
    await Promise.all(transitionIds.current.map((n) => Notifications?.cancelScheduledNotificationAsync(n)));
  }

  async function ack(kind: 'hydration' | 'movement' | 'meal') {
    if (sessionId) await api.guardrailAck(sessionId, kind).catch(() => {});
    setGuardrailAt(elapsedMin + GUARDRAIL_REPEAT_MIN);
  }

  async function leave(done: boolean) {
    if (sessionId) await api.endSession(sessionId).catch(() => {});
    if (done) await api.complete(id, Math.max(1, Math.round(elapsedMin))).catch(() => {});
    router.back();
  }

  const R = 110;
  const C = 2 * Math.PI * R;
  return (
    <Screen>
      <T kind="muted">{inFlow ? 'Protected: nudges paused, body checks still on' : 'Focus'}</T>
      <T kind="title">{title}</T>
      <View style={{ alignItems: 'center', justifyContent: 'center', marginVertical: space.lg }}>
        <Svg width={260} height={260}>
          <Circle cx={130} cy={130} r={R} stroke={t.soft} strokeWidth={18} fill="none" />
          <Circle
            cx={130} cy={130} r={R} stroke={remaining > 0 ? t.accent : t.warm} strokeWidth={18} fill="none"
            strokeDasharray={`${C * fraction} ${C}`} strokeLinecap="round" transform="rotate(-90 130 130)"
          />
        </Svg>
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          <T kind="title" style={{ fontSize: 44, fontVariant: ['tabular-nums'] }}>{remaining < 0 ? '+' : ''}{mm}:{ss}</T>
          <T kind="muted">{remaining > 0 ? 'left' : 'over. No rush'}</T>
        </View>
      </View>
      {!inFlow && <Button kind="quiet" label="I'm in flow" onPress={enterFlow} />}
      <Button label="Done" onPress={() => leave(true)} />
      <Button kind="quiet" label="Step away (it'll be here)" onPress={() => leave(false)} />

      <Modal visible={elapsedMin >= guardrailAt} animationType={t.calm ? 'none' : 'fade'} onRequestClose={() => {}}>
        <Screen>
          <T kind="title">Quick body check</T>
          <T>You’ve been deep in this for {Math.round(elapsedMin)} minutes. Nice. Take one small thing for your body, then dive back in.</T>
          <Card>
            <Button kind="quiet" label="Drank some water" onPress={() => ack('hydration')} />
            <Button kind="quiet" label="Stood up and stretched" onPress={() => ack('movement')} />
            <Button kind="quiet" label="Grabbed food" onPress={() => ack('meal')} />
          </Card>
        </Screen>
      </Modal>
    </Screen>
  );
}
