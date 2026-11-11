export const FinanceTheme = {
  colors: {
    background: '#070B14',
    backgroundSoft: '#101927',
    backgroundElevated: '#162235',
    glass: 'rgba(28, 39, 58, 0.68)',
    glassStrong: 'rgba(36, 49, 72, 0.84)',
    glassSubtle: 'rgba(255, 255, 255, 0.06)',
    border: 'rgba(186, 221, 255, 0.22)',
    borderStrong: 'rgba(207, 238, 255, 0.42)',
    cyan: '#7DF9FF',
    cyanSoft: 'rgba(125, 249, 255, 0.22)',
    cyanMuted: '#A9F8FF',
    magenta: '#E879F9',
    magentaSoft: 'rgba(232, 121, 249, 0.24)',
    violet: '#B78CFF',
    success: '#77F2B2',
    warning: '#FFD166',
    danger: '#FF7A90',
    text: '#F7FBFF',
    textMuted: '#B8C7D9',
    textSubtle: '#7F90A8',
    white: '#FFFFFF',
    black: '#000000',
    // AquaFinance / Stitch Oceanic Deep Palette
    abyss: {
      950: '#020d10',
      900: '#021616',
      800: '#071e22',
      700: '#0c2a2f',
    },
    // Phthalo Blue ("Azul Ftalo") palette for embroidery, borders & glows
    phthalo: {
      900: '#002540',
      800: '#003865',
      700: '#0a3871',
      600: '#004d7a',
      500: '#005c8a',
      400: '#006994',
      300: '#0f52ba',
    },
    // Aqua Teal highlights & interactive actions
    aquateal: {
      300: '#5ffbd6',
      400: '#26ebd0',
      500: '#00d2b4',
      600: '#00b89d',
    },
    phthaloBorder: 'rgba(0, 92, 138, 0.55)',
    phthaloBorderInput: 'rgba(0, 92, 138, 0.45)',
    phthaloGlow: 'rgba(10, 56, 113, 0.45)',
    aquaGlow: 'rgba(0, 210, 180, 0.25)',
  },
  gradients: {
    background: ['#070B14', '#0E1725', '#111827'],
    oceanicMesh: ['#021616', '#020d10', '#071e22'],
    glass: ['rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.04)'],
    cyanGlow: ['rgba(125, 249, 255, 0.44)', 'rgba(125, 249, 255, 0)'],
    magentaGlow: ['rgba(232, 121, 249, 0.40)', 'rgba(232, 121, 249, 0)'],
    aquatealButton: ['#00d2b4', '#26ebd0', '#1cd8bf'],
  },
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
  },
  radius: {
    xs: 6,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 22,
  },
  typography: {
    hero: 34,
    title: 26,
    heading: 20,
    body: 16,
    caption: 13,
    micro: 11,
    button: 15,
  },
  borderWidth: {
    hairline: 1,
    emphasis: 1.5,
  },
  opacity: {
    disabled: 0.52,
    pressed: 0.82,
    overlay: 0.72,
  },
  shadow: {
    card: {
      color: '#7DF9FF',
      opacity: 0.18,
      radius: 22,
      offsetY: 10,
      elevation: 8,
    },
    magenta: {
      color: '#E879F9',
      opacity: 0.22,
      radius: 24,
      offsetY: 10,
      elevation: 9,
    },
    phthaloGlow: {
      color: '#004d7a',
      opacity: 0.45,
      radius: 24,
      offsetY: 0,
      elevation: 8,
    },
    buttonGlow: {
      color: '#00d2b4',
      opacity: 0.4,
      radius: 20,
      offsetY: 4,
      elevation: 7,
    },
  },
  neon: {
    cyan: {
      borderColor: 'rgba(125, 249, 255, 0.58)',
      shadowColor: '#7DF9FF',
    },
    magenta: {
      borderColor: 'rgba(232, 121, 249, 0.58)',
      shadowColor: '#E879F9',
    },
    mixed: {
      borderColor: 'rgba(186, 221, 255, 0.34)',
      shadowColor: '#A9F8FF',
    },
  },
} as const;

export type FinanceAccent = 'cyan' | 'magenta' | 'mixed';

export type FinanceThemeType = typeof FinanceTheme;
