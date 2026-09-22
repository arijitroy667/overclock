import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextProps, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, space, touch, useTheme } from './theme';

export function Screen({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: radius, padding: space.md, gap: space.sm }, style]}>
      {children}
    </View>
  );
}

export function T({ kind = 'body', style, ...props }: TextProps & { kind?: 'title' | 'h2' | 'body' | 'muted' }) {
  const t = useTheme();
  const s = {
    title: { fontSize: 26, fontWeight: '700' as const, color: t.text },
    h2: { fontSize: 19, fontWeight: '600' as const, color: t.text },
    body: { fontSize: 16, color: t.text, lineHeight: 22 },
    muted: { fontSize: 14, color: t.muted, lineHeight: 20 },
  }[kind];
  return <Text {...props} style={[s, style]} />;
}

export function Button({
  label, onPress, kind = 'primary', disabled, accessibilityLabel,
}: { label: string; onPress: () => void; kind?: 'primary' | 'quiet'; disabled?: boolean; accessibilityLabel?: string }) {
  const t = useTheme();
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primary ? t.accent : t.soft, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={{ color: primary ? t.accentText : t.text, fontSize: 16, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: touch, borderRadius: radius, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
});
