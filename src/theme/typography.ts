import { TextStyle } from 'react-native';

/** Abhaya Libre, loaded in app/_layout.tsx */
export const fontFamily = {
  heading: 'AbhayaLibre_400Regular',
} as const;

export const typography = {
  hero: {
    fontFamily: fontFamily.heading,
    fontSize: 32,
    fontWeight: '400',
    letterSpacing: -0.5,
  } as TextStyle,
  title: {
    fontFamily: fontFamily.heading,
    fontSize: 22,
    fontWeight: '400',
    letterSpacing: -0.3,
  } as TextStyle,
  subtitle: {
    fontSize: 17,
    fontWeight: '600',
  } as TextStyle,
  body: {
    fontSize: 16,
    fontWeight: '400',
  } as TextStyle,
  caption: {
    fontSize: 13,
    fontWeight: '500',
  } as TextStyle,
  label: {
    fontFamily: fontFamily.heading,
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  } as TextStyle,
};
