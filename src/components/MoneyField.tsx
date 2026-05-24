import { useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { colors, radius, spacing, typography, inputAccent } from '@/theme';
import {
  centsToDisplay,
  centsToEditableString,
  parseMoneyDraftToCents,
  sanitizeMoneyDraft,
} from '@/lib/moneyInput';

type Props = {
  cents: number;
  onChangeCents: (cents: number) => void;
  style?: TextInputProps['style'];
  compact?: boolean;
};

export function MoneyField({ cents, onChangeCents, style, compact }: Props) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');

  const displayValue = focused ? draft : centsToDisplay(cents);

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={styles.dollar}>$</Text>
      <TextInput
        style={[styles.input, compact && styles.inputCompact, style]}
        keyboardType={Platform.OS === 'web' ? 'default' : 'decimal-pad'}
        inputMode="decimal"
        placeholder="0.00"
        placeholderTextColor={colors.textMuted}
        value={displayValue}
        selectTextOnFocus={false}
        onFocus={() => {
          setDraft(centsToEditableString(cents));
          setFocused(true);
        }}
        onBlur={() => {
          onChangeCents(parseMoneyDraftToCents(draft));
          setDraft('');
          setFocused(false);
        }}
        onChangeText={(text) => {
          setDraft(sanitizeMoneyDraft(text));
        }}
        {...inputAccent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  wrapCompact: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
  },
  dollar: {
    ...typography.body,
    color: colors.textMuted,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  inputCompact: {
    width: 80,
    flex: undefined,
    textAlign: 'right',
    paddingVertical: 0,
  },
});
