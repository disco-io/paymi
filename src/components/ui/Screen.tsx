import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme';

type Props = ViewProps & {
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  noGradient?: boolean;
};

export function Screen({
  children,
  style,
  edges = ['top', 'bottom'],
  noGradient,
  ...rest
}: Props) {
  return (
    <View style={styles.root} {...rest}>
      {!noGradient && (
        <LinearGradient
          colors={[colors.cream, '#F5F2E8', colors.creamDark]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}
      <SafeAreaView style={[styles.safe, style]} edges={edges}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  safe: {
    flex: 1,
  },
});
