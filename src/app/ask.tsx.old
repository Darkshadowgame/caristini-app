import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { agentTurn } from '../ai/agent';
import { ChatTurn, hasClaude } from '../ai/claude';
import { codingItemsFor } from '../coding/items';
import { loadHistory } from '../history';
import { useSettings } from '../settings';
import { useConnection } from '../state';
import { radius, space, type, useTheme } from '../theme';
import { GUIDES } from '../help';
import { Button, ConfirmSheet, HelpButton, Icon, IconName, tap } from '../ui';
import { useGarage, vehicleTitle } from '../vehicle/garage';

type Shown = { mine: boolean; text: string; actions?: string[] };

const STARTERS = [
  'How is my car running right now?',
  'Read all the sensors and tell me anything to watch',
  'What do my faults mean, and is it safe to drive?',
  'Which settings can I change on this car?',
];
// Offered only on cars whose settings list has a needle sweep.
const SWEEP_STARTER = 'Turn on the needle sweep';

// Caristini AI: a chat that works with the car. It reads sensors, faults,
// modules and settings through tools, explains them for this car, and can
// change a setting when asked, after the owner taps Allow.
// The conversation per car, kept while the app runs, so leaving the chat
// (or opening it from Home instead of the AI tab) does not lose it.
const CHATS = new Map<string, { api: ChatTurn[]; shown: Shown[] }>();

export default function Ask() {
  const t = useTheme();
  const conn = useConnection();
  const garage = useGarage();
  const { settings } = useSettings();
  const params = useLocalSearchParams<{ q?: string }>();
  const v = conn.vehicle ?? garage.vehicles[0];
  const starters = v && codingItemsFor(v.group, v.platform).some((i) => /needle sweep/i.test(i.title)) ? [...STARTERS, SWEEP_STARTER] : STARTERS;
  const [ready, setReady] = useState<boolean | null>(null);
  const [api, setApi] = useState<ChatTurn[]>([]);
  const [shown, setShown] = useState<Shown[]>([]);
  // Each car has its own conversation: switching car swaps it.
  const chatVin = useRef<string | null>(null);
  useEffect(() => {
    const vin = v?.vin ?? null;
    if (vin === chatVin.current) return;
    chatVin.current = vin;
    const saved = vin ? CHATS.get(vin) : undefined;
    setApi(saved?.api ?? []);
    setShown(saved?.shown ?? []);
  }, [v?.vin]);
  useEffect(() => {
    if (chatVin.current && (api.length || shown.length)) CHATS.set(chatVin.current, { api, shown });
  }, [api, shown]);
  const [draft, setDraft] = useState('');
  const stopAsk = useRef(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState('');
  const [ask, setAsk] = useState<{ title: string; lines: string[] } | null>(null);
  const answer = useRef<((ok: boolean) => void) | null>(null);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  // Checked each time the chat comes into view, so a key just saved in Settings counts.
  useFocusEffect(
    useCallback(() => {
      hasClaude().then(setReady);
    }, []),
  );

  useEffect(() => {
    if (!v) return;
    loadHistory(v.vin).then((h) => {
      setContext(
        [
          v.odometerKm ? `Odometer about ${Math.round(v.odometerKm / 1.609344)} miles.` : '',
          v.knowledge ? `Modules learned: ${Object.values(v.knowledge).map((k) => k.plainName).join(', ')}.` : 'Modules not learned yet (Learn my car).',
          h.length ? `Recent history: ${h.slice(0, 8).map((e) => `${new Date(e.at).toLocaleDateString('en-GB')} ${e.title}`).join('; ')}.` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      );
    });
  }, [v?.vin]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    if (!v) {
      setError('Connect your car once so Caristini AI knows which car it is.');
      return;
    }
    stopAsk.current = false;
    tap();
    setDraft('');
    setError(null);
    setShown((s) => [...s, { mine: true, text: q }]);
    const history: ChatTurn[] = [...api, { role: 'user', content: q }];
    setBusy('Thinking');
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    try {
      const res = await agentTurn(
        {
          client: conn.client,
          vehicle: v,
          update: (patch) => garage.update(v.vin, patch),
          latest: () => garage.latest(v.vin),
          imperial: { speed: settings.speed === 'mph', temp: settings.temp === '°F' },
          status: (s) => setBusy(s),
          cancelled: () => stopAsk.current,
          confirm: (title, lines) =>
            new Promise<boolean>((resolve) => {
              answer.current = resolve;
              setAsk({ title, lines });
            }),
        },
        history,
        context,
      );
      setApi([...history, ...res.turns]);
      setShown((s) => [...s, { mine: false, text: res.answer, actions: res.actions }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setShown((s) => s.slice(0, -1));
      setDraft(q);
    } finally {
      setBusy(null);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  // Opened with a question (from Knowledge or a fault): ask it straight away.
  const asked = useRef(false);
  useEffect(() => {
    if (ready && params.q && !asked.current && context !== null) {
      asked.current = true;
      send(params.q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, params.q]);

  const decide = (ok: boolean) => {
    setAsk(null);
    answer.current?.(ok);
    answer.current = null;
  };

  if (ready === false) {
    return (
      <View style={[styles.empty, { backgroundColor: t.bg }]}>
        <Icon name={'creation' as IconName} size={44} color={t.accent} />
        <Text style={[type.title3, { color: t.text, marginTop: space.md }]}>Add your Claude key</Text>
        <Text style={[type.sub, { color: t.muted, textAlign: 'center', marginTop: space.sm, marginBottom: space.lg }]}>
          Caristini AI uses your own Claude API key. Paste it once in Settings; it stays on this phone.
        </Text>
        <Button label="Open Settings" icon="tune-variant" onPress={() => router.push('/settings')} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView ref={scroll} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
        {!shown.length ? (
          <View style={{ marginBottom: space.lg }}>
            <View style={[styles.badge, { backgroundColor: t.accentSoft }]}>
              <Icon name={'creation' as IconName} size={28} color={t.accent} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.md }}>
              <Text style={[type.title, { color: t.text, flex: 1 }]}>Caristini AI</Text>
              <HelpButton help={GUIDES.ai} size={22} label="How it works" />
            </View>
            <Text style={[type.sub, { color: t.muted, marginTop: 4, marginBottom: space.lg }]}>
              {conn.client
                ? `Connected to ${v ? vehicleTitle(v) : 'your car'}. I can read every sensor and module, explain what they mean for this car, and change settings when you ask. Changes always wait for you to tap Allow.`
                : 'Connect the adapter so I can read the car. Without it I can still answer from the last health check and History.'}
            </Text>
            {starters.map((s) => (
              <Pressable key={s} accessibilityRole="button" onPress={() => send(s)} style={({ pressed }) => [styles.starter, { backgroundColor: pressed ? t.raised : t.surface }]}>
                <Icon name={'creation' as IconName} size={16} color={t.accent} />
                <Text style={[type.body, { color: t.text, flex: 1 }]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {shown.map((m, i) => (
          <View key={i} style={[styles.bubble, m.mine ? { alignSelf: 'flex-end', backgroundColor: t.accent } : { alignSelf: 'flex-start', backgroundColor: t.surface }]}>
            {m.actions?.map((a, k) => (
              <View key={k} style={[styles.action, { backgroundColor: t.okSoft }]}>
                <Icon name="check-circle" size={14} color={t.ok} />
                <Text style={[type.small, { color: t.ok, flex: 1 }]}>{a}</Text>
              </View>
            ))}
            <Text selectable style={[type.body, { color: m.mine ? t.onAccent : t.text }]}>
              {m.text.replace(/\*\*/g, '').replace(/^#+\s*/gm, '')}
            </Text>
          </View>
        ))}
        {busy ? (
          <View style={[styles.bubble, { alignSelf: 'flex-start', backgroundColor: t.surface, flexDirection: 'row', gap: space.sm, alignItems: 'center' }]}>
            <ActivityIndicator color={t.accent} />
            <Text style={[type.sub, { color: t.muted }]}>{busy}…</Text>
          </View>
        ) : null}
        {error ? <Text style={[type.sub, { color: t.danger, marginTop: space.sm }]}>{error}</Text> : null}
      </ScrollView>
      <View style={[styles.composer, { backgroundColor: t.surface, borderColor: t.border }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask about your car, or ask for a change"
          placeholderTextColor={t.muted}
          multiline
          style={[type.body, styles.input, { color: t.text, backgroundColor: t.sunken }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
        />
        {busy ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stop"
            onPress={() => {
              tap();
              stopAsk.current = true;
              setBusy('Stopping');
            }}
            style={[styles.send, { backgroundColor: t.sunken }]}
          >
            <Icon name={'stop' as IconName} size={20} color={t.text} />
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Send" disabled={!draft.trim()} onPress={() => send(draft)} style={[styles.send, { backgroundColor: draft.trim() ? t.accent : t.sunken }]}>
            <Icon name={'arrow-up' as IconName} size={20} color={draft.trim() ? t.onAccent : t.faint} />
          </Pressable>
        )}
      </View>
      <ConfirmSheet visible={!!ask} title={ask?.title ?? ''} lines={ask?.lines ?? []} confirmLabel="Allow" cancelLabel="Don't change" onConfirm={() => decide(true)} onCancel={() => decide(false)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, paddingBottom: space.xl, maxWidth: 640, width: '100%', alignSelf: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  badge: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  starter: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, marginBottom: space.sm },
  bubble: { maxWidth: '88%', borderRadius: radius.lg, paddingHorizontal: space.md + 2, paddingVertical: space.sm + 2, marginBottom: space.sm, gap: 6 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, padding: space.sm, paddingBottom: space.lg, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, borderRadius: 18, paddingHorizontal: space.md, paddingVertical: 9, maxHeight: 140 },
  send: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
