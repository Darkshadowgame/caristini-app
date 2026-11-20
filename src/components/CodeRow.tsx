// One row for a fault code, the same in every fault list (Health check,
// Workshop, the last health check and its changes): the code people look up
// as a chip, the fault's title, and one line beneath for its state or module.
// Tapping opens the code page.
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { faultMeaning } from '../diag/faults';
import { describeFailureType, STATE_LABEL, UdsFault } from '../obd/uds';
import { useConnection } from '../state';
import { MONO, space, type, useTheme } from '../theme';
import { Icon, tap } from '../ui';

export function CodeRow({
  code,
  label,
  title,
  sub,
  module,
  moduleId,
  state,
  first,
  right,
}: {
  code: string;
  // The chip text when it differs from the code (P0011 for P0011B5).
  label?: string;
  title?: string;
  sub: string;
  module?: string;
  moduleId?: string;
  state?: string;
  first?: boolean;
  // A tag at the right end (New, Seen before, Cleared).
  right?: React.ReactNode;
}) {
  const t = useTheme();
  const brand = useConnection().vehicle?.brand;
  const meaning = faultMeaning(code, { module, brand });
  const entry = meaning.entry;
  const serious = entry?.severity === 'high';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${code}. ${title ?? entry?.title ?? ''}. ${sub}`}
      onPress={() => {
        tap();
        router.push({ pathname: '/code/[code]', params: { code, ...(module ? { module } : {}), ...(moduleId ? { moduleId } : {}), ...(state ? { state } : {}) } });
      }}
      style={({ pressed }) => [styles.code, { borderColor: t.border, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, backgroundColor: pressed ? t.raised : 'transparent' }]}
    >
      <View style={[styles.codeChip, { backgroundColor: serious ? t.dangerSoft : t.sunken }]}>
        <Text style={[styles.codeId, { color: serious ? t.danger : t.text }]}>{label ?? code}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.callout, { color: t.text }]} numberOfLines={2}>
          {title ?? meaning.title}
        </Text>
        <Text style={[type.small, { color: t.muted, marginTop: 1 }]}>{sub}</Text>
      </View>
      {right ?? null}
      <Icon name="chevron-right" size={13} color={t.faint} />
    </Pressable>
  );
}

// A fault read from a control module: its state in the words of STATE_LABEL
// ("Active now", "Stored"), the failure type and the warning light.
export function FaultRow({ fault, module, moduleId, first }: { fault: UdsFault; module: string; moduleId?: string; first?: boolean }) {
  const brand = useConnection().vehicle?.brand;
  const ftb = describeFailureType(fault.failureType);
  // The same title and type the code page shows for this module.
  const title = faultMeaning(fault.code, { module, brand }).title;
  const sub = fault.kwp
    ? 'Stored in the module'
    : [STATE_LABEL[fault.state], fault.failureType ? ftb : null, fault.warningLamp ? 'Warning light on' : null].filter(Boolean).join(' · ');
  // The chip shows the code people look up (P0011); the type byte is in the line below.
  return <CodeRow label={fault.base || undefined} code={fault.code} title={title} sub={sub} module={module} moduleId={moduleId} state={STATE_LABEL[fault.state]} first={first} />;
}

const styles = StyleSheet.create({
  code: { flexDirection: 'row', gap: space.md, paddingVertical: space.md, paddingLeft: space.lg, paddingRight: space.lg, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  codeChip: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4 },
  codeId: { fontSize: 13, fontWeight: '700', fontFamily: MONO, fontVariant: ['tabular-nums'] },
});
