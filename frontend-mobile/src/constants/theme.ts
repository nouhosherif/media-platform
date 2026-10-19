export const colors = {
  background: '#f4f5f7',
  feedBackground: '#f6f7f9',
  surface: '#ffffff',
  surfaceMuted: '#fafafa',
  surfaceStrong: '#f0f1f3',
  profileHero: '#eef0ff',
  text: '#111214',
  textSecondary: '#52565c',
  textMuted: '#73777f',
  textSubtle: '#a0a4ab',
  border: '#e7e8eb',
  borderStrong: '#d4d6da',
  ink: '#111214',
  charcoal: '#242629',
  primary: '#111214',
  primaryPressed: '#2d3034',
  skySurface: '#f1f2f4',
  skyText: '#34383e',
  darkSurface: '#111214',
  darkSurfaceRaised: '#202226',
  darkBorder: '#303238',
  darkText: '#ffffff',
  darkMuted: '#a7abb3',
  error: '#b91c1c',
  errorBorder: '#fecaca',
  errorSurface: '#fef2f2',
  success: '#166534',
  successBorder: '#bbf7d0',
  successSurface: '#f0fdf4',
  amber: '#b45309',
  amberSurface: '#fef3c7',
  white: '#ffffff',
  black: '#000000',
} as const;

export const semanticColors = {
  textPrimary: colors.black,
  iconPrimary: colors.black,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  small: 10,
  input: 16,
  card: 20,
  media: 16,
  button: 18,
  authCard: 24,
  round: 999,
} as const;

export const fontSize = {
  caption: 12,
  body: 14,
  input: 16,
  section: 18,
  screenTitle: 28,
  authTitle: 28,
} as const;

export const layout = {
  contentMaxWidth: 600,
  feedMaxWidth: 640,
  navIconSize: 22,
  avatarSmall: 44,
  avatarLarge: 144,
} as const;
