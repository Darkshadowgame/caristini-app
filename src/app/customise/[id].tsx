import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { MODS, STATUS_HELP, STATUS_LABEL } from '../../mods/catalogue';
import { radius, space, type, useTheme } from '../../theme';
import { Body, Card, Group, Icon, ListRow, Notice, Pill, Screen, Title } from '../../ui';

export default function ModDetail() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mod = MODS.find((m) => m.id === id);
  if (!mod) {
    return (
      <Screen>
        <Notice tone="danger" text="This guide was not found." />
      </Screen>
    );
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: mod.category }} />
      {/* The title block is a card, as on the code page; each section below is a group with its label outside. */}
      <Card style={{ padding: space.xl }}>
        <Title>{mod.title}</Title>
        <Text style={[type.sub, { color: t.muted, marginTop: space.sm }]}>{mod.summary}</Text>
        <View style={{ marginTop: space.md }}>
          <Pill text={STATUS_LABEL[mod.status]} tone={mod.status === 'owner' ? 'ok' : mod.status === 'dealer' ? 'neutral' : 'info'} />
        </View>
        <View style={[styles.locked, { backgroundColor: t.sunken }]}>
          <Icon name={mod.status === 'owner' ? 'hand-back-right-outline' : 'book-open-variant'} size={16} color={t.muted} />
          <Body small style={{ flex: 1 }}>{STATUS_HELP[mod.status]}</Body>
        </View>
      </Card>

      <Group header="Options">
        {mod.options.map((o, i) => (
          <ListRow key={o} first={i === 0} title={o} />
        ))}
      </Group>

      {mod.caution ? <Notice icon="alert-outline" text={mod.caution} /> : null}

      <Group header="Where it lives">
        <ListRow first title="Module" subtitle={mod.module} />
        <ListRow title="Setting" subtitle={mod.location} />
        <ListRow title="Applies to" subtitle={mod.platforms?.join(', ') ?? 'All models of this make (check yours)'} />
      </Group>

      <Group header="Sources" footer="Each opens in the browser.">
        {mod.sources.map((s, i) => (
          <ListRow key={s.url} first={i === 0} icon="open-in-new" iconColour="grey" title={s.label} onPress={() => Linking.openURL(s.url)} />
        ))}
      </Group>
    </Screen>
  );
}

const styles = StyleSheet.create({
  locked: { flexDirection: 'row', gap: space.sm, borderRadius: radius.md, padding: space.md, marginTop: space.lg },
});
