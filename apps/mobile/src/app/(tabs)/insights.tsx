import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { api, Insights as Data } from '@/api';
import { radius, space, useTheme } from '@/theme';
import { Card, Screen, T } from '@/ui';

export default function Insights() {
  const t = useTheme();
  const [data, setData] = useState<Data | null>(null);
  useFocusEffect(useCallback(() => { api.insights().then(setData).catch(() => {}); }, []));

  if (!data) return <Screen><T kind="muted">Loading…</T></Screen>;

  const energy = Object.entries(data.energy_by_day);
  const todayDone = data.xp_today >= data.xp_daily_cap;
  return (
    <Screen>
      <T kind="title">Your week</T>
      <Card>
        <T kind="h2">Showed up {data.days_active_this_week} of the last 7 days</T>
        <T kind="muted">{data.days_active_total} days total. Gaps don’t reset anything. Pick up wherever you are.</T>
      </Card>
      <Card>
        <T kind="h2">Level {data.level} · {data.xp} XP</T>
        <View style={{ height: 10, borderRadius: radius, backgroundColor: t.soft, overflow: 'hidden' }}>
          <View style={{ height: 10, width: `${(data.xp_today / data.xp_daily_cap) * 100}%`, backgroundColor: t.accent }} />
        </View>
        <T kind="muted">
          {todayDone ? "Today's XP is full. That's a real finish line. Rest counts too." : `${data.xp_today} / ${data.xp_daily_cap} XP today`}
        </T>
      </Card>
      <Card>
        <T kind="h2">Finished this week</T>
        <T>{data.completion_rate === null ? 'Nothing captured yet' : `${Math.round(data.completion_rate * 100)}% of what you captured`}</T>
      </Card>
      {energy.length > 0 && (
        <Card>
          <T kind="h2">Energy</T>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, height: 90 }}>
            {energy.map(([day, avg]) => (
              <View key={day} style={{ flex: 1, alignItems: 'center', gap: space.xs }}>
                <View style={{ width: '70%', height: (avg / 5) * 70, borderRadius: 6, backgroundColor: t.accent }} />
                <T kind="muted" style={{ fontSize: 11 }}>{new Date(day).toLocaleDateString(undefined, { weekday: 'short' })}</T>
              </View>
            ))}
          </View>
        </Card>
      )}
    </Screen>
  );
}
