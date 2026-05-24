import { BlurView } from 'expo-blur';
import { StyleSheet, View, ViewProps, Platform } from 'react-native';
import { colors, radius } from '@/theme';

type Props = ViewProps & {
  intensity?: number;
  contentStyle?: ViewProps['style'];
};

export function GlassCard({
  style,
  contentStyle,
  children,
  intensity = 40,
  ...rest
}: Props) {
  if (Platform.OS === 'android') {
    return (
      <View style={[styles.fallback, style]} {...rest}>
        {children}
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]} {...rest}>
      <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
  },
  fallback: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    padding: 16,
  },
  content: {
    padding: 16,
  },
});
