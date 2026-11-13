import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import {
  AccessibilityInfo,
  ActionSheetIOS,
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mascot } from './brand/Mascot';
import { GuideId, GUIDES, Help } from './help';
import { radius, space, Theme, ToolColour, type, useTheme } from './theme';

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// SF Symbols on iPhone; the Material icon of the same meaning elsewhere.
const SF: Partial<Record<string, string>> = {
  'alert-circle': 'exclamationmark.circle.fill',
  'alert-circle-outline': 'exclamationmark.circle',
  'alert-outline': 'exclamationmark.triangle',
  'alert-octagon-outline': 'exclamationmark.octagon',
  'bell-alert-outline': 'bell.badge',
  barcode: 'barcode',
  bluetooth: 'antenna.radiowaves.left.and.right',
  broom: 'eraser',
  'car-battery': 'minus.plus.batteryblock',
  'car-brake-alert': 'exclamationmark.brakesignal',
  'car-connected': 'car.fill',
  'car-door': 'door.left.hand.open',
  'car-info': 'info.circle',
  'car-light-high': 'headlight.high.beam',
  'car-side': 'car.side.fill',
  'chart-timeline-variant': 'waveform.path.ecg',
  check: 'checkmark',
  'check-circle': 'checkmark.circle.fill',
  'check-circle-outline': 'checkmark.circle',
  'checkbox-blank-circle': 'circle.fill',
  'chevron-down': 'chevron.down',
  'chevron-right': 'chevron.right',
  'chevron-up': 'chevron.up',
  chip: 'cpu',
  'circle-outline': 'circle',
  'clipboard-check-outline': 'checklist',
  close: 'xmark',
  'close-circle': 'xmark.circle.fill',
  'code-tags': 'chevron.left.forwardslash.chevron.right',
  'content-copy': 'doc.on.doc',
  'compare-horizontal': 'arrow.left.arrow.right',
  'flash-outline': 'bolt',
  speedometer: 'speedometer',
  'timer-outline': 'timer',
  'file-document-outline': 'doc.text',
  'record-circle-outline': 'record.circle',
  stop: 'stop.fill',
  'content-save-outline': 'square.and.arrow.down',
  'database-search-outline': 'magnifyingglass.circle',
  engine: 'engine.combustion.fill',
  'engine-outline': 'engine.combustion',
  'garage-open-variant': 'door.garage.open',
  'garage-variant': 'door.garage.closed',
  gauge: 'gauge.with.dots.needle.67percent',
  'hand-back-right-outline': 'hand.raised',
  'heart-pulse': 'heart.text.square.fill',
  'help-circle-outline': 'questionmark.circle',
  'information-outline': 'info.circle',
  leaf: 'leaf.fill',
  'link-variant-off': 'power',
  'lock-outline': 'lock',
  magnify: 'magnifyingglass',
  'magnify-close': 'magnifyingglass',
  'mirror-rectangle': 'rectangle.portrait',
  'note-outline': 'note.text',
  'notebook-check-outline': 'book.closed.fill',
  'notebook-outline': 'book.closed',
  'open-in-new': 'arrow.up.right.square',
  pause: 'pause.fill',
  'pencil-outline': 'pencil',
  play: 'play.fill',
  'playlist-check': 'checklist',
  plus: 'plus',
  'progress-clock': 'clock',
  refresh: 'arrow.clockwise',
  restart: 'arrow.counterclockwise',
  'share-variant': 'square.and.arrow.up',
  'shield-check-outline': 'checkmark.shield',
  'star-outline': 'star',
  steering: 'steeringwheel',
  stethoscope: 'stethoscope',
  'trash-can-outline': 'trash',
  'tune-variant': 'slider.horizontal.3',
  'wrench-clock': 'wrench.and.screwdriver.fill',
  'wrench-outline': 'wrench.adjustable',
  oil: 'oilcan.fill',
  tire: 'tirepressure',
  ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [`numeric-${n}-circle-outline`, `${n}.circle`])),
};

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const t = useTheme();
  const c = color ?? t.text;
  const fallback = <MaterialCommunityIcons name={name} size={size} color={c} />;
  const sf = SF[name];
  if (Platform.OS !== 'ios' || !sf) return fallback;
  return (
    <SymbolView
      name={sf as React.ComponentProps<typeof SymbolView>['name']}
      size={size}
      tintColor={c}
      resizeMode="scaleAspectFit"
      style={{ width: size, height: size }}
      fallback={fallback}
    />
  );
}

export function tap() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => undefined);
}

export function success() {
  if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

export function useReduceMotion(): boolean {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setOn, () => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setOn);
    return () => sub.remove();
  }, []);
  return on;
}

// The web preview draws the tab bar across the top; leave room for it.
const WEB_TAB_BAR = Platform.OS === 'web' ? 56 : 0;

// Scrolling page. Tab roots pass a large title, drawn in the content the way
// iOS draws it, below the safe area.
export function Screen({
  children,
  padded = true,
  title,
  trailing,
  guide,
}: {
  children: React.ReactNode;
  padded?: boolean;
  title?: string;
  trailing?: React.ReactNode;
  // Tab roots: the screen's own guide, as a ? beside the trailing control.
  guide?: Help;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  // On a phone the tab's own stack header shows the title (a large title on
  // iOS) with any trailing control as its right button; the web preview has
  // no header, so the title is drawn in the page.
  const inPage = !!title && Platform.OS === 'web';
  const right =
    guide && trailing ? (
      <View style={styles.headerRight}>
        <HelpButton help={guide} size={inPage ? 22 : 24} tint="accent" />
        {trailing}
      </View>
    ) : guide ? (
      <HelpButton help={guide} size={inPage ? 22 : 24} tint="accent" />
    ) : (
      trailing
    );
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={[padded && { paddingHorizontal: space.lg, paddingTop: inPage ? insets.top + space.sm + WEB_TAB_BAR : title ? space.sm : space.lg, paddingBottom: 120 }]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      {title && !inPage ? <Stack.Screen options={{ title, headerRight: right ? () => right : undefined }} /> : null}
      <View style={styles.column}>
        {inPage ? (
          <View style={styles.largeTitleRow}>
            <Text accessibilityRole="header" style={[type.display, { color: t.text, flex: 1 }]}>
              {title}
            </Text>
            {right}
          </View>
        ) : null}
        {children}
      </View>
    </ScrollView>
  );
}

// Trailing title control: a plain bar button in the native header, a filled
// circle beside the in-page title on the web preview.
export function HeaderButton({ icon, label, onPress, filled }: { icon: IconName; label: string; onPress: () => void; filled?: boolean }) {
  const t = useTheme();
  const web = Platform.OS === 'web';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.headerButton,
        web && { backgroundColor: filled ? t.accent : t.surface },
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Icon name={icon} size={web ? 18 : 22} color={web && filled ? t.onAccent : t.accentText} />
    </Pressable>
  );
}

// Inset grouped container (iOS grouped list section).
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.surface }, style]}>{children}</View>;
}

// A card washed with a soft diagonal glow in the colour of its state.
export function GlowCard({ tone, children, style }: { tone: 'brand' | 'ok' | 'fault'; children: React.ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  const colors = tone === 'ok' ? t.glowOk : tone === 'fault' ? t.glowFault : t.glowBrand;
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }} style={[styles.card, style]}>
      {children}
    </LinearGradient>
  );
}

// A grouped list section: optional header above, footer below. With help, a
// ? at the right end of the header line explains the section.
export function Group({ header, footer, children, style, help }: { header?: string; footer?: string; children: React.ReactNode; style?: ViewStyle; help?: Help }) {
  const t = useTheme();
  return (
    <View style={[{ marginBottom: space.xl }, style]}>
      {help ? (
        <View style={[styles.groupHeaderRow, !header && { justifyContent: 'flex-end' }]}>
          {header ? <Text style={[type.label, { color: t.muted, flex: 1 }]}>{header}</Text> : null}
          <HelpButton help={help} />
        </View>
      ) : header ? (
        <Text style={[type.label, styles.groupHeader, { color: t.muted }]}>{header}</Text>
      ) : null}
      <View style={[styles.group, { backgroundColor: t.surface }]}>{children}</View>
      {footer ? <Text style={[type.small, styles.groupFooter, { color: t.muted }]}>{footer}</Text> : null}
    </View>
  );
}

export function Label({ children, style, help }: { children: React.ReactNode; style?: TextStyle; help?: Help }) {
  const t = useTheme();
  const text = <Text style={[type.label, { color: t.muted, marginBottom: space.sm }, style, help && { marginBottom: 0, flex: 1 }]}>{children}</Text>;
  if (!help) return text;
  return (
    <View style={[styles.labelRow, style?.marginTop != null && { marginTop: style.marginTop }]}>
      {text}
      <HelpButton help={help} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Help: a ? that opens a sheet saying what a screen or section does.
// ---------------------------------------------------------------------------

// Scrollable help sheet: a page sheet on iPhone, a bottom sheet elsewhere.
export function HelpSheet({ help, visible, onClose }: { help: Help; visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const ios = Platform.OS === 'ios';
  const body = (
    <>
      <Text accessibilityRole="header" style={[type.title, { color: t.text }]}>
        {help.title}
      </Text>
      <Text style={[type.label, styles.helpLabel, { color: t.muted }]}>What it does</Text>
      <Text style={[type.body, { color: t.text }]}>{help.what}</Text>
      <Text style={[type.label, styles.helpLabel, { color: t.muted }]}>How it works</Text>
      {help.how.map((step, i) => (
        <View key={i} style={styles.helpStep}>
          <View style={[styles.helpNum, { backgroundColor: t.accentSoft }]}>
            <Text style={[type.caption, { color: t.accentText, fontWeight: '700' }]}>{i + 1}</Text>
          </View>
          <Text style={[type.body, { color: t.text, flex: 1 }]}>{step}</Text>
        </View>
      ))}
      {help.note ? (
        <View style={{ marginTop: space.md }}>
          <Notice tone="info" icon="information-outline" text={help.note} />
        </View>
      ) : null}
    </>
  );
  if (ios) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: t.bg }}>
          <View style={[styles.helpBar, { borderColor: t.border }]}>
            <View style={styles.helpBarSide} />
            <Text style={[type.heading, { color: t.text, flex: 1, textAlign: 'center' }]}>Help</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Done" hitSlop={10} onPress={onClose} style={[styles.helpBarSide, { alignItems: 'flex-end' }]}>
              <Text style={[type.body, { color: t.accentText, fontWeight: '600' }]}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl }}>
            <View style={styles.column}>{body}</View>
          </ScrollView>
        </View>
      </Modal>
    );
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.scrim, { paddingHorizontal: 0 }]} onPress={onClose} accessibilityLabel="Close help">
        <Pressable style={[styles.helpSheet, { backgroundColor: t.surface, paddingBottom: insets.bottom + space.md }]} onPress={() => undefined}>
          <View style={[styles.grabber, { backgroundColor: t.border }]} />
          <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ padding: space.lg }}>
            {body}
          </ScrollView>
          <View style={{ paddingHorizontal: space.lg }}>
            <Button label="Done" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// A small ? that opens the help for a screen or section. The tap target is
// at least 44 pt. tint "accent" for header bars; muted beside section headers.
export function HelpButton({ help, size = 18, label, tint = 'muted' }: { help: Help; size?: number; label?: string; tint?: 'muted' | 'accent' }) {
  const t = useTheme();
  const [open, setOpen] = React.useState(false);
  const colour = tint === 'accent' ? t.accentText : t.muted;
  const box = size + 10;
  const slop = Math.max(0, Math.ceil((44 - box) / 2));
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Help: ${help.title}`}
        hitSlop={slop}
        onPress={() => {
          tap();
          setOpen(true);
        }}
        style={({ pressed }) => [styles.helpButton, { minWidth: box, height: box, opacity: pressed ? 0.5 : 1 }]}
      >
        <Icon name="help-circle-outline" size={size} color={colour} />
        {label ? <Text style={[type.sub, { color: colour, fontWeight: '600' }]}>{label}</Text> : null}
      </Pressable>
      <HelpSheet help={help} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

// The ? for a pushed screen's header bar, showing that screen's guide.
export function GuideButton({ id }: { id: GuideId }) {
  return <HelpButton help={GUIDES[id]} size={22} tint="accent" />;
}

export function Body({ children, style, muted, small }: { children: React.ReactNode; style?: TextStyle; muted?: boolean; small?: boolean }) {
  const t = useTheme();
  return <Text style={[small ? type.sub : type.body, { color: muted ? t.muted : t.text }, style]}>{children}</Text>;
}

export function Title({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const t = useTheme();
  return (
    <Text accessibilityRole="header" style={[type.title, { color: t.text }, style]}>
      {children}
    </Text>
  );
}

export function Heading({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const t = useTheme();
  return (
    <Text accessibilityRole="header" style={[type.heading, { color: t.text }, style]}>
      {children}
    </Text>
  );
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  busy,
  disabled,
  style,
  compact,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  busy?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  // Smaller capsule for a row of several buttons.
  compact?: boolean;
}) {
  const t = useTheme();
  const c = buttonColours(t, variant);
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      onPress={
        off
          ? undefined
          : () => {
              tap();
              onPress();
            }
      }
      style={({ pressed }) => [
        styles.button,
        variant === 'ghost' && styles.ghost,
        compact && styles.compact,
        { backgroundColor: c.bg, opacity: off ? 0.4 : pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={c.fg} /> : icon ? <Icon name={icon} size={18} color={c.fg} /> : null}
      <Text numberOfLines={1} style={[styles.buttonText, compact && styles.compactText, { color: c.fg }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function buttonColours(t: Theme, v: Variant) {
  if (v === 'primary') return { bg: t.accent, fg: t.onAccent };
  if (v === 'danger') return { bg: t.dangerSoft, fg: t.danger };
  if (v === 'ghost') return { bg: 'transparent', fg: t.accentText };
  return { bg: t.accentSoft, fg: t.accentText };
}

export type Tone = 'ok' | 'danger' | 'neutral' | 'accent' | 'info';

export function toneColours(t: Theme, tone: Tone) {
  switch (tone) {
    case 'ok':
      return { bg: t.okSoft, fg: t.ok };
    case 'danger':
      return { bg: t.dangerSoft, fg: t.danger };
    case 'accent':
      return { bg: t.accentSoft, fg: t.accentText };
    case 'info':
      return { bg: t.infoSoft, fg: t.info };
    default:
      return { bg: t.sunken, fg: t.muted };
  }
}

export function Pill({ text, tone = 'neutral', icon }: { text: string; tone?: Tone; icon?: IconName }) {
  const t = useTheme();
  const c = toneColours(t, tone);
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      {icon ? <Icon name={icon} size={11} color={c.fg} /> : null}
      <Text style={[styles.pillText, { color: c.fg }]}>{text}</Text>
    </View>
  );
}

// Label and value on one line, as in a grouped settings cell.
export function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.row, { borderColor: t.border }]}>
      <Text style={[type.body, { color: t.text }]}>{label}</Text>
      <Text selectable style={[type.body, styles.rowValue, { color: t.muted }, mono && styles.mono]}>
        {value}
      </Text>
    </View>
  );
}

// Settings-style row: a white glyph on a coloured rounded square, title,
// optional subtitle, trailing value and chevron.
export function ListRow({
  icon,
  iconTone = 'neutral',
  iconColour,
  title,
  subtitle,
  value,
  right,
  onPress,
  first,
  disabled,
  noChevron,
  selected,
  mono,
  leading,
}: {
  // Custom leading artwork (a maker logo) in place of the icon square.
  leading?: React.ReactNode;
  icon?: IconName;
  iconTone?: Tone;
  iconColour?: ToolColour;
  title: string;
  subtitle?: string;
  value?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  first?: boolean;
  disabled?: boolean;
  // A choice row (checkmark, no chevron), as in an iOS selection list.
  noChevron?: boolean;
  selected?: boolean;
  // Set the value in Menlo (codes, VINs).
  mono?: boolean;
}) {
  const t = useTheme();
  const tone = toneColours(t, iconTone);
  const content = (
    <>
      {leading ? <View style={{ marginRight: space.md }}>{leading}</View> : null}
      {icon && !leading ? (
        <View style={[styles.rowIcon, { backgroundColor: iconColour ? t[iconColour] : tone.bg }]}>
          <Icon name={icon} size={17} color={iconColour ? '#FFFFFF' : tone.fg} />
        </View>
      ) : null}
      <View style={[styles.rowMain, { borderColor: t.border, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth }]}>
        <View style={{ flex: 1, paddingVertical: subtitle ? 10 : 0 }}>
          <Text style={[type.body, { color: t.text }]}>{title}</Text>
          {subtitle ? <Text style={[type.sub, { color: t.muted, marginTop: 1 }]}>{subtitle}</Text> : null}
        </View>
        {value ? (
          <Text numberOfLines={2} style={[type.body, type.number, { color: t.muted, flexShrink: 1, maxWidth: '55%', textAlign: 'right' }, mono && styles.mono]}>
            {value}
          </Text>
        ) : null}
        {right ? <View style={{ alignSelf: 'center' }}>{right}</View> : null}
        {selected ? <Icon name="check" size={17} color={t.accentText} /> : null}
        {onPress && !disabled && !noChevron && selected == null ? <Icon name="chevron-right" size={13} color={t.faint} /> : null}
      </View>
    </>
  );
  const style = [styles.listRow, { opacity: disabled ? 0.45 : 1 }];
  if (!onPress || disabled) {
    return (
      <View style={style} accessible accessibilityState={{ disabled: !!disabled }}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole={selected != null && noChevron ? 'checkbox' : 'button'}
      accessibilityState={selected != null ? { checked: selected } : undefined}
      accessibilityLabel={[title, subtitle, value].filter(Boolean).join('. ')}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [style, pressed && { backgroundColor: t.raised }]}
    >
      {content}
    </Pressable>
  );
}

export function Notice({ text, tone = 'neutral', icon }: { text: string; tone?: Tone; icon?: IconName }) {
  const t = useTheme();
  const c = toneColours(t, tone);
  return (
    <View style={[styles.notice, { backgroundColor: tone === 'neutral' ? t.surface : c.bg }]}>
      {icon ? <Icon name={icon} size={18} color={c.fg} /> : null}
      <Text style={[type.sub, { color: tone === 'neutral' ? t.text : c.fg, flex: 1 }]}>{text}</Text>
    </View>
  );
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const t = useTheme();
  return (
    <View style={[styles.search, { backgroundColor: t.sunken }]}>
      <Icon name="magnify" size={16} color={t.muted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={t.muted}
        autoCapitalize="characters"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
        accessibilityLabel={placeholder}
        selectionColor={t.accent}
        style={[type.body, { flex: 1, color: t.text, paddingVertical: 8 }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
      />
      {value && Platform.OS !== 'ios' ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChange('')} hitSlop={12}>
          <Icon name="close-circle" size={16} color={t.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

// Action-sheet style confirmation: message and the destructive action in one
// group, Cancel in its own below, as iOS lays it out.
export function ConfirmSheet({
  visible,
  title,
  lines,
  confirmLabel,
  onConfirm,
  onCancel,
  cancelLabel = 'Cancel',
  neutral = false,
}: {
  visible: boolean;
  title: string;
  lines: string[];
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  cancelLabel?: string;
  // Not red: for questions such as "Did you see the change?".
  neutral?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  // One press only: the sheet stays tappable while it slides away.
  const [pressed, setPressed] = React.useState(false);
  React.useEffect(() => {
    if (visible) setPressed(false);
  }, [visible]);
  // iPhone: the system action sheet, destructive action in red, Cancel apart.
  React.useEffect(() => {
    if (Platform.OS !== 'ios' || !visible) return;
    ActionSheetIOS.showActionSheetWithOptions(
      { title, message: lines.join(' '), options: [cancelLabel, confirmLabel], cancelButtonIndex: 0, destructiveButtonIndex: neutral ? undefined : 1, tintColor: t.accentText },
      (i) => (i === 1 ? onConfirm() : onCancel()),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  if (Platform.OS === 'ios') return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.scrim} onPress={onCancel} accessibilityLabel="Cancel">
        <View style={{ paddingBottom: insets.bottom + space.sm, width: '100%', maxWidth: 520, alignSelf: 'center' }}>
          <Pressable style={[styles.sheet, { backgroundColor: t.surface }]} onPress={() => undefined}>
            <View style={styles.sheetMessage}>
              <Text style={[type.heading, { color: t.text, textAlign: 'center' }]}>{title}</Text>
              {lines.map((l) => (
                <Text key={l} style={[type.small, { color: t.muted, textAlign: 'center', marginTop: space.sm }]}>
                  {l}
                </Text>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (pressed) return;
                setPressed(true);
                onConfirm();
              }}
              style={({ pressed: p }) => [styles.sheetButton, { borderColor: t.border, backgroundColor: p ? t.raised : 'transparent' }]}
            >
              <Text style={[styles.sheetButtonText, { color: neutral ? t.accentText : t.danger }]}>{confirmLabel}</Text>
            </Pressable>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            style={({ pressed: p }) => [styles.sheet, styles.cancel, { backgroundColor: p ? t.raised : t.surface }]}
          >
            <Text style={[styles.sheetButtonText, { color: t.accentText, fontWeight: '600' }]}>{cancelLabel}</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

// Thin bar with a percentage that glides to each new value.
// "about 6 min left" from how fast the work has gone so far; null until there
// is enough to judge (5 items and 5 seconds).
export function timeLeft(done: number, total: number, startedAt: number, now = Date.now()): string | null {
  const elapsed = now - startedAt;
  if (done < 5 || elapsed < 5000 || total <= done) return null;
  const s = ((total - done) * elapsed) / done / 1000;
  if (s < 60) return 'under a minute left';
  const m = Math.round(s / 60);
  if (m < 90) return `about ${m} min left`;
  const h = Math.floor(m / 60);
  return `about ${h} h ${m - h * 60} min left`;
}

export function ProgressBar({ value, label, done, total, startedAt }: { value: number; label?: string; done?: number; total?: number; startedAt?: number }) {
  const t = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  const counts = done != null && total ? `${Math.min(done, total).toLocaleString('en-GB')} of ${total.toLocaleString('en-GB')}` : null;
  const eta = !startedAt ? null : done != null && total ? timeLeft(done, total, startedAt) : pct > 0.02 ? timeLeft(Math.round(pct * 1000), 1000, startedAt) : null;
  const anim = React.useRef(new Animated.Value(pct)).current;
  React.useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 400, easing: Easing.out(Easing.exp), useNativeDriver: false }).start();
  }, [pct, anim]);
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={[type.sub, { color: t.muted, flex: 1 }]} numberOfLines={1}>
          {label ?? ''}
        </Text>
        <Text style={[type.sub, type.number, { color: t.text, fontWeight: '600' }]}>{Math.round(pct * 100)}%</Text>
      </View>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: t.sunken, overflow: 'hidden' }}>
        <Animated.View
          style={{ height: 4, borderRadius: 2, backgroundColor: t.accent, width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }}
        />
      </View>
      {counts || (startedAt && eta) ? (
        <Text style={[type.small, type.number, { color: t.muted, marginTop: 6 }]}>
          {[counts, startedAt ? (eta ?? (counts ? 'working out the time left' : null)) : null].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}

// The signature moment: the car symbol inside rings that ripple outwards
// while Caristini talks to the car. Still under Reduce Motion.
export function ScanPulse({ active, size = 120, colour, children }: { active: boolean; size?: number; colour?: string; children?: React.ReactNode }) {
  const t = useTheme();
  const c = colour ?? t.accent;
  const reduce = useReduceMotion();
  const rings = React.useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  React.useEffect(() => {
    if (!active || reduce) {
      rings.forEach((r) => r.setValue(0));
      return undefined;
    }
    const loops = rings.map((r, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 600),
          Animated.timing(r, { toValue: 1, duration: 1800, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(r, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, reduce, rings]);
  const core = size * 0.56;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessible={false}>
      {rings.map((r, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: core,
            height: core,
            borderRadius: core / 2,
            borderWidth: 2,
            borderColor: c,
            opacity: r.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.55, 0] }),
            transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [1, size / core] }) }],
          }}
        />
      ))}
      {children ?? (
        <View style={{ width: core, height: core, borderRadius: core / 2, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="car-side" size={core * 0.5} color={c} />
        </View>
      )}
    </View>
  );
}

// Content that arrives (a module's result) slides up and fades in once.
export function Arrive({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const reduce = useReduceMotion();
  const v = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: reduce ? 0 : 420, easing: Easing.out(Easing.exp), useNativeDriver: true }).start();
  }, [v, reduce]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

export function NeedsConnection({ what, title }: { what?: string; title?: string }) {
  const t = useTheme();
  const router = useRouter();
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxl * 2, paddingHorizontal: space.xl }}>
      <Mascot mood="asleep" size={120} />
      <Text style={[type.title3, { color: t.text, marginTop: space.lg, textAlign: 'center' }]}>{title ?? `Connect to see ${what}`}</Text>
      <Text style={[type.sub, { color: t.muted, textAlign: 'center', marginTop: space.sm }]}>
        Plug in the adapter and switch the ignition on.
      </Text>
      <Button label="Connect adapter" icon="bluetooth" onPress={() => router.push('/connect')} style={{ marginTop: space.lg, alignSelf: 'stretch' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  column: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  headerButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  largeTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: space.lg, marginTop: space.sm },
  card: { borderRadius: radius.lg, padding: space.lg, marginBottom: space.lg },
  group: { borderRadius: radius.lg, overflow: 'hidden' },
  groupHeader: { marginLeft: space.lg, marginBottom: 6 },
  groupHeaderRow: { flexDirection: 'row', alignItems: 'center', marginLeft: space.lg, marginRight: space.xs, marginBottom: 2, marginTop: -6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: space.xs, marginTop: -6 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  helpButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 5 },
  helpLabel: { marginTop: space.lg, marginBottom: space.sm },
  helpStep: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', marginBottom: space.sm },
  helpNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  helpBar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: space.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  helpBarSide: { width: 70, minHeight: 44, justifyContent: 'center' },
  grabber: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: space.sm },
  helpSheet: { maxHeight: '85%', width: '100%', maxWidth: 640, alignSelf: 'center', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, overflow: 'hidden' },
  groupFooter: { marginHorizontal: space.lg, marginTop: 6 },
  button: {
    minHeight: 50,
    borderRadius: 25,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: space.sm,
  },
  ghost: { minHeight: 44, paddingHorizontal: space.md },
  compact: { minHeight: 44, paddingHorizontal: space.md, gap: 6 },
  compactText: { fontSize: 15, letterSpacing: -0.24 },
  buttonText: { fontSize: 17, fontWeight: '600', letterSpacing: -0.41 },
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { fontSize: 13, fontWeight: '600', letterSpacing: -0.08 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, gap: space.md },
  rowValue: { flexShrink: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 14 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: space.lg, minHeight: 50 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'stretch', minHeight: 50, paddingRight: space.lg, marginLeft: 0 },
  rowIcon: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginRight: space.md },
  notice: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', borderRadius: radius.md, padding: space.md, marginBottom: space.lg },
  search: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 8, minHeight: 36 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', paddingHorizontal: space.sm },
  sheet: { borderRadius: 14, overflow: 'hidden' },
  sheetMessage: { paddingHorizontal: space.lg, paddingVertical: space.lg },
  sheetButton: { minHeight: 57, alignItems: 'center', justifyContent: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  sheetButtonText: { fontSize: 20, letterSpacing: 0.38 },
  cancel: { marginTop: space.sm, minHeight: 57, alignItems: 'center', justifyContent: 'center' },
});

export type RingState = 'pending' | 'current' | 'ok' | 'faults' | 'none' | 'error';

// The health check's signature: one dot per control module around the car,
// filling in as each answers (green clear, red faults, dim not fitted) while
// the module being asked pulses amber. Still under Reduce Motion.
export function ModuleRing({ states, size = 170, children }: { states: RingState[]; size?: number; children?: React.ReactNode }) {
  const t = useTheme();
  const reduce = useReduceMotion();
  const pulse = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (reduce) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduce]);
  const n = Math.max(1, states.length);
  const dot = Math.max(6, Math.min(12, (Math.PI * size) / n - 4));
  const r = size / 2 - dot;
  const colour = (s: RingState) => (s === 'ok' ? t.ok : s === 'faults' ? t.danger : s === 'current' ? t.accent : s === 'error' ? t.orange : s === 'none' ? t.faint : t.sunken);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`${states.filter((s) => s !== 'pending' && s !== 'current').length} of ${states.length} modules checked`}>
      {states.map((s, i) => {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const style = {
          position: 'absolute' as const,
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          backgroundColor: colour(s),
          left: size / 2 + r * Math.cos(a) - dot / 2,
          top: size / 2 + r * Math.sin(a) - dot / 2,
          opacity: s === 'none' ? 0.5 : 1,
        };
        return s === 'current' ? (
          <Animated.View key={i} style={[style, { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }] }]} />
        ) : (
          <View key={i} style={style} />
        );
      })}
      {children}
    </View>
  );
}
