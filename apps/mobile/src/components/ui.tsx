/**
 * Componentes base con la identidad de Go Unplugged (Poppins + Inter, negro + índigo).
 */
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { brand, fonts, radius, space, useThemeColors } from '../theme';

export function Screen({
  children,
  scroll = true,
  padded = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
}) {
  const c = useThemeColors();
  const inner = <View style={[{ gap: space.lg }, padded && { padding: space.lg }]}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

export function Title({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const c = useThemeColors();
  return <Text style={[{ fontFamily: fonts.heading, fontSize: 28, lineHeight: 34, color: c.ink }, style]}>{children}</Text>;
}

export function Heading({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const c = useThemeColors();
  return <Text style={[{ fontFamily: fonts.heading, fontSize: 18, color: c.ink }, style]}>{children}</Text>;
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: TextStyle }) {
  const c = useThemeColors();
  return (
    <Text style={[{ fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: muted ? c.inkSoft : c.ink }, style]}>
      {children}
    </Text>
  );
}

/** Etiqueta en mayúsculas, estilo "LÍMITE DIARIO · REDES SOCIALES". */
export function Eyebrow({ children, color }: { children: ReactNode; color?: string }) {
  const c = useThemeColors();
  return (
    <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 1.2, color: color ?? c.inkFaint }}>
      {typeof children === 'string' ? children.toUpperCase() : children}
    </Text>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const c = useThemeColors();
  const bg: Record<ButtonVariant, string> = {
    primary: c.primary,
    secondary: c.bgRaised2,
    ghost: 'transparent',
    danger: c.danger,
  };
  const fg = variant === 'primary' || variant === 'danger' ? c.onPrimary : c.ink;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          minHeight: 50,
          borderRadius: radius.md,
          paddingHorizontal: space.xl,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed && variant === 'primary' ? c.primaryPressed : bg[variant],
          borderWidth: variant === 'ghost' || variant === 'secondary' ? StyleSheet.hairlineWidth * 2 : 0,
          borderColor: c.line,
          opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: fg }}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style, accent }: { children: ReactNode; style?: ViewStyle; accent?: boolean }) {
  const c = useThemeColors();
  return (
    <View
      style={[
        {
          backgroundColor: accent ? c.primary : c.bgRaised,
          borderRadius: radius.lg,
          borderWidth: accent ? 0 : 1,
          borderColor: c.line,
          padding: space.lg,
          gap: space.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const c = useThemeColors();
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: c.inkSoft }}>{label}</Text>
      <TextInput
        placeholderTextColor={c.inkFaint}
        {...props}
        style={[
          {
            minHeight: 50,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: c.line,
            backgroundColor: c.bgRaised,
            color: c.ink,
            paddingHorizontal: space.lg,
            fontFamily: fonts.body,
            fontSize: 16,
          },
          props.style,
        ]}
      />
    </View>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'danger' | 'warning' | 'primary' }) {
  const c = useThemeColors();
  const color = { neutral: c.inkSoft, success: c.success, danger: c.danger, warning: c.warning, primary: brand.indigoLight }[tone];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: color,
        paddingHorizontal: space.sm + 2,
        paddingVertical: 3,
      }}
    >
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, color }}>{label}</Text>
    </View>
  );
}

/** Selector de minutos en "chips" (15 / 30 / 60…). */
export function ChipPicker<T extends string | number>({
  options,
  value,
  onChange,
  format = (v) => String(v),
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  const c = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {options.map((o) => {
        const active = o === value;
        return (
          <Pressable
            key={String(o)}
            onPress={() => onChange(o)}
            accessibilityState={{ selected: active }}
            style={{
              paddingHorizontal: space.lg,
              paddingVertical: space.sm + 2,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: active ? c.primary : c.line,
              backgroundColor: active ? c.primary : 'transparent',
            }}
          >
            <Text style={{ fontFamily: fonts.bodySemi, color: active ? c.onPrimary : c.ink }}>{format(o)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md }, style]}>{children}</View>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  const c = useThemeColors();
  if (!children) return null;
  return <Text style={{ fontFamily: fonts.bodyMedium, color: c.danger }}>{children}</Text>;
}

export function Loading() {
  const c = useThemeColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
      <ActivityIndicator color={c.primary} />
    </View>
  );
}

/* ---------------------------------------------------------------------------
 * Piezas "editoriales": menos tarjetas, más listas y tipografía.
 * ------------------------------------------------------------------------- */

/** Número grande (minutos, cuenta regresiva, código). */
export function BigNumber({ children, size = 64, color }: { children: ReactNode; size?: number; color?: string }) {
  const c = useThemeColors();
  return (
    <Text
      style={{
        fontFamily: fonts.headingHeavy,
        fontSize: size,
        lineHeight: size * 1.08,
        letterSpacing: -size * 0.02,
        fontVariant: ['tabular-nums'],
        color: color ?? c.ink,
      }}
    >
      {children}
    </Text>
  );
}

/** Sección sin caja: título en minúscula + filas separadas por líneas finas. */
export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const c = useThemeColors();
  return (
    <View style={{ gap: 0 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }}>
        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: c.inkFaint }}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  right,
  rightColor,
  onPress,
  chevron,
  children,
}: {
  title: string;
  subtitle?: string | null;
  right?: string;
  rightColor?: string;
  onPress?: () => void;
  chevron?: boolean;
  children?: ReactNode;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        paddingVertical: space.md + 2,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: c.line,
        opacity: pressed ? 0.6 : 1,
        gap: space.sm,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: 16, color: c.ink }}>{title}</Text>
          {subtitle ? <Text style={{ fontFamily: fonts.body, fontSize: 14, color: c.inkSoft }}>{subtitle}</Text> : null}
        </View>
        {right ? (
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: rightColor ?? c.inkSoft, fontVariant: ['tabular-nums'] }}>{right}</Text>
        ) : null}
        {chevron ? <Text style={{ fontSize: 20, color: c.inkFaint, marginLeft: -4 }}>›</Text> : null}
      </View>
      {children}
    </Pressable>
  );
}

/** Punto de color + texto (reemplaza las pastillas con borde). */
export function StatusDot({ label, color }: { label: string; color: string }) {
  const c = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: c.inkSoft }}>{label}</Text>
    </View>
  );
}

export function TextLink({ title, onPress, color }: { title: string; onPress?: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, paddingVertical: space.xs })}>
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: color ?? brand.indigoLight }}>{title}</Text>
    </Pressable>
  );
}

export function Avatar({ name, size = 36 }: { name?: string | null; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: brand.indigo, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.heading, fontSize: size * 0.42, color: '#fff' }}>{(name ?? '?').slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

/** Control segmentado (una sola barra) para elegir minutos. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  format = (v) => String(v),
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  const c = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.bgRaised2, borderRadius: radius.md, padding: 3 }}>
      {options.map((o) => {
        const active = o === value;
        return (
          <Pressable
            key={String(o)}
            onPress={() => onChange(o)}
            accessibilityState={{ selected: active }}
            style={{ flex: 1, paddingVertical: space.sm + 2, borderRadius: radius.sm, alignItems: 'center', backgroundColor: active ? c.primary : 'transparent' }}
          >
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: active ? c.onPrimary : c.inkSoft, fontVariant: ['tabular-nums'] }}>{format(o)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Campo sin caja, solo línea inferior. */
export function LineField(props: TextInputProps & { label: string }) {
  const c = useThemeColors();
  const { label, ...rest } = props;
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: c.inkFaint }}>{label}</Text>
      <TextInput
        placeholderTextColor={c.inkFaint}
        {...rest}
        style={[{ borderBottomWidth: 1, borderBottomColor: c.line, color: c.ink, fontFamily: fonts.body, fontSize: 17, paddingVertical: space.sm }, rest.style]}
      />
    </View>
  );
}
