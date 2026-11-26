import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
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
import { useState, type ComponentProps, type PropsWithChildren, type ReactNode } from 'react';

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
  compact = false,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  busy?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
  compact?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const color = secondary ? colors.text : colors.accentText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: busy, busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
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
        icon && <Ionicons name={icon} size={compact ? 18 : 20} color={color} />
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
export function ExpandableSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: PropsWithChildren<{ title: string; summary?: string; defaultOpen?: boolean }>) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View
      style={[styles.expandable, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [styles.expandableHeader, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Txt kind="label">{title}</Txt>
          {summary ? <Txt kind="muted">{summary}</Txt> : null}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.secondary} />
      </Pressable>
      {open ? <View style={{ gap: 14 }}>{children}</View> : null}
    </View>
  );
}
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.segmented, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segmentedItem,
              {
                opacity: pressed ? 0.75 : 1,
                backgroundColor: selected ? colors.accent : 'transparent',
              },
            ]}
          >
            <Txt
              kind="label"
              style={{ color: selected ? colors.accentText : colors.text, textAlign: 'center' }}
            >
              {option.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
export function IconButton({
  icon,
  label,
  onPress,
  busy = false,
  destructive = false,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  busy?: boolean;
  destructive?: boolean;
}) {
  const { colors } = useTheme();
  const color = destructive ? colors.error : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy, busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        {
          opacity: pressed || busy ? 0.65 : 1,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={color} />
      ) : (
        <Ionicons name={icon} size={20} color={color} />
      )}
    </Pressable>
  );
}
export function CompactRow({
  title,
  subtitle,
  onPress,
  right,
  last = false,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const content = (
    <View style={{ flex: 1, gap: 2 }}>
      <Txt kind="label">{title}</Txt>
      {subtitle ? <Txt kind="muted">{subtitle}</Txt> : null}
    </View>
  );
  return (
    <View
      style={[
        styles.compactRow,
        !last && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
          onPress={onPress}
          style={({ pressed }) => [
            { flex: 1, minHeight: 48, justifyContent: 'center', opacity: pressed ? 0.7 : 1 },
          ]}
        >
          {content}
        </Pressable>
      ) : (
        <View style={{ flex: 1, minHeight: 48, justifyContent: 'center' }}>{content}</View>
      )}
      {right}
    </View>
  );
}
export type ActionSheetOption = {
  label: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
  destructive?: boolean;
  onPress: () => void;
};
export function ActionSheetModal({
  visible,
  title,
  subtitle,
  onClose,
  actions,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  actions: ActionSheetOption[];
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar menu de ações"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            styles.modalSheet,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={{ gap: 4 }}>
            <Txt kind="heading">{title}</Txt>
            {subtitle ? <Txt kind="muted">{subtitle}</Txt> : null}
          </View>
          <View style={{ gap: 4 }}>
            {actions.map((action) => {
              const color = action.destructive ? colors.error : colors.text;
              return (
                <Pressable
                  key={action.label}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  onPress={() => {
                    onClose();
                    action.onPress();
                  }}
                  style={({ pressed }) => [
                    styles.modalAction,
                    { opacity: pressed ? 0.7 : 1, borderColor: colors.border },
                  ]}
                >
                  {action.icon ? <Ionicons name={action.icon} size={20} color={color} /> : null}
                  <Txt kind="label" style={{ color, flex: 1 }}>
                    {action.label}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
          <Button secondary title="Cancelar" onPress={onClose} />
        </View>
      </View>
    </Modal>
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
  buttonCompact: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
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
  expandable: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
  },
  expandableHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segmentedItem: {
    flex: 1,
    minHeight: 48,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  iconButton: {
    minWidth: 48,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactRow: {
    minHeight: 56,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    padding: 16,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  modalAction: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
    paddingVertical: 12,
  },
});
