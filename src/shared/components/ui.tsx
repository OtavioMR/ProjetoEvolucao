import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ComponentProps, PropsWithChildren } from 'react';

import { useTheme } from '../theme/theme';

export function Txt({
  kind = 'body',
  style,
  ...props
}: TextProps & { kind?: 'body' | 'title' | 'heading' | 'label' | 'muted' | 'eyebrow' }) {
  const { colors } = useTheme();
  return (
    <Text
      {...props}
      style={[
        { color: kind === 'muted' || kind === 'eyebrow' ? colors.secondary : colors.text },
        styles[kind],
        style,
      ]}
    />
  );
}
export function Screen({ children, insetTop = true }: PropsWithChildren<{ insetTop?: boolean }>) {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={insetTop ? ['top', 'left', 'right'] : ['left', 'right']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.screen}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <View style={{ width: '100%', maxWidth: 600, alignSelf: 'center', gap: 20 }}>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}
    >
      {children}
    </View>
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  busy = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  busy?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
}) {
  const { colors } = useTheme();
  const color = secondary ? colors.text : colors.accentText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: busy, busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          opacity: pressed || busy ? 0.65 : 1,
          backgroundColor: secondary ? colors.surface : colors.accent,
          borderColor: secondary ? colors.border : colors.accent,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={color} />
      ) : (
        icon && <Ionicons name={icon} size={20} color={color} />
      )}
      <Txt kind="label" style={{ color, flexShrink: 1 }}>
        {busy ? 'Salvando…' : title}
      </Txt>
    </Pressable>
  );
}
export function Field({
  label,
  error,
  hint,
  ...props
}: TextInputProps & { label: string; error?: string; hint?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 7 }}>
      <Txt kind="label">{label}</Txt>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={colors.secondary}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.input,
            borderColor: error ? colors.error : colors.border,
          },
          props.style,
        ]}
      />
      {hint && <Txt kind="muted">{hint}</Txt>}
      {error && (
        <Txt accessibilityRole="alert" style={{ color: colors.error }}>
          {error}
        </Txt>
      )}
    </View>
  );
}
export function Toggle({
  title,
  detail,
  value,
  onChange,
}: {
  title: string;
  detail?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 4 }}>
        <Txt kind="label">{title}</Txt>
        {detail && <Txt kind="muted">{detail}</Txt>}
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={value ? colors.accentText : colors.secondary}
        style={{ minHeight: 48, minWidth: 48 }}
      />
    </View>
  );
}
export function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.choice,
        {
          backgroundColor: selected ? colors.accent : colors.surface,
          borderColor: selected ? colors.accent : colors.border,
        },
      ]}
    >
      <Txt kind="label" style={{ color: selected ? colors.accentText : colors.text }}>
        {label}
      </Txt>
    </Pressable>
  );
}
export function NavRow({
  title,
  detail,
  href,
  icon,
}: {
  title: string;
  detail: string;
  href: Href;
  icon: ComponentProps<typeof Ionicons>['name'];
}) {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      onPress={() => router.push(href)}
      style={[styles.navRow, { borderColor: colors.border }]}
    >
      <Ionicons name={icon} size={23} color={colors.accent} />
      <View style={{ flex: 1, gap: 4 }}>
        <Txt kind="label">{title}</Txt>
        <Txt kind="muted">{detail}</Txt>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.secondary} />
    </Pressable>
  );
}
export function Notice({ children, error = false }: PropsWithChildren<{ error?: boolean }>) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole={error ? 'alert' : undefined}
      style={{
        borderLeftWidth: 3,
        borderLeftColor: error ? colors.error : colors.accent,
        paddingLeft: 14,
        gap: 8,
      }}
    >
      <Txt kind="muted" style={error ? { color: colors.error } : undefined}>
        {children}
      </Txt>
    </View>
  );
}
export function Header({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Txt kind="eyebrow">{eyebrow}</Txt>
      <Txt kind="title" accessibilityRole="header">
        {title}
      </Txt>
      <Txt kind="muted">{description}</Txt>
    </View>
  );
}
export const styles = StyleSheet.create({
  screen: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48, flexGrow: 1 },
  body: { fontSize: 16, lineHeight: 24 },
  title: { fontSize: 32, lineHeight: 39, fontWeight: '700', letterSpacing: -0.7 },
  heading: { fontSize: 21, lineHeight: 28, fontWeight: '600' },
  label: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  muted: { fontSize: 14, lineHeight: 21 },
  eyebrow: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  card: { padding: 20, borderWidth: 1, borderRadius: 18, gap: 16 },
  button: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 13,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  choice: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRow: {
    minHeight: 76,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderBottomWidth: 1,
  },
});
