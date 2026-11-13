import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { MODS, STATUS_HELP, STATUS_LABEL } from '../../mods/catalogue';
import { radius, space, type, useTheme } from '../../theme';
import { Body, Card, Heading, Icon, Label, Notice, Pill, Row, Screen } from '../../ui';

export default function ModDetail() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mod = MODS.find((m) => m.id === id);
  if (!mod) {
    return (
      <Screen>
        <Notice tone="danger" text="This customisation was not found." />
      </Screen>
    );
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: mod.category }} />
      <Heading style={{ fontSize: 24 }}>{mod.title}</Heading>
      <Body muted style={{ marginTop: space.xs, marginBottom: space.md }}>
        {mod.summary}
      </Body>
      <Pill text={STATUS_LABEL[mod.status]} tone={mod.status === 'owner' ? 'ok' : mod.status === 'dealer' ? 'neutral' : 'info'} />

      <Card style={{ marginTop: space.md }}>
        <Label>Options</Label>
        {mod.options.map((o, i) => (
          <View key={o} style={[styles.option, { borderColor: t.border, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}>
            <View style={[styles.radio, { borderColor: i === 0 ? t.accent : t.border }]}>
              {i === 0 ? <View style={[styles.dot, { backgroundColor: t.accent }]} /> : null}
            </View>
            <Body style={{ flex: 1, color: i === 0 ? t.text : t.muted }}>{o}</Body>
          </View>
        ))}
        <View style={[styles.locked, { backgroundColor: t.sunken }]}>
          <Icon name={mod.status === 'owner' ? 'hand-back-right-outline' : 'lock-outline'} size={16} color={t.muted} />
          <Body small style={{ flex: 1 }}>{STATUS_HELP[mod.status]}</Body>
        </View>
      </Card>

      {mod.caution ? <Notice tone="accent" icon="alert-outline" text={mod.caution} /> : null}

      <Card>
        <Label>Where it lives</Label>
        <Row label="Module" value={mod.module} />
        <Row label="Setting" value={mod.location} />
        <Row label="Applies to" value={mod.platforms?.join(', ') ?? 'All models of this make (check yours)'} />
      </Card>

      <Card>
        <Label>Sources</Label>
        {mod.sources.map((s) => (
          <Pressable key={s.url} accessibilityRole="link" onPress={() => Linking.openURL(s.url)} style={styles.source}>
            <Icon name="open-in-new" size={16} color={t.accentText} />
            <Text style={[type.small, { color: t.accentText, fontWeight: '700', flex: 1, textDecorationLine: 'underline' }]}>{s.label}</Text>
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  locked: { flexDirection: 'row', gap: space.sm, borderRadius: radius.md, padding: space.md, marginTop: space.sm },
  source: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
});
