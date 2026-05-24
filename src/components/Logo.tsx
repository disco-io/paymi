import { StyleSheet, Text, TextProps } from 'react-native';
import { colors, fontFamily } from '@/theme';

type Props = TextProps & {
  size?: 'hero' | 'header';
};

export function Logo({ size = 'hero', style, ...rest }: Props) {
  return (
    <Text
      style={[
        size === 'hero' ? styles.hero : styles.header,
        style,
      ]}
      {...rest}
    >
      paymi
    </Text>
  );
}

const styles = StyleSheet.create({
  hero: {
    fontFamily: fontFamily.heading,
    fontStyle: 'italic',
    fontSize: 48,
    color: colors.primary,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  header: {
    fontFamily: fontFamily.heading,
    fontStyle: 'italic',
    fontSize: 32,
    color: colors.primary,
    letterSpacing: -0.3,
  },
});
