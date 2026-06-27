/** Central dark theme. Kept tiny and flat so screens can pull tokens directly. */
export const theme = {
  colors: {
    bg: '#0B0B0F',
    surface: '#15151C',
    surfaceAlt: '#1E1E28',
    border: '#2A2A36',
    text: '#ECECF1',
    textDim: '#9A9AA8',
    accent: '#7C5CFF',
    accentDim: '#5B45B8',
    userBubble: '#2A2440',
    assistantBubble: '#17171F',
    danger: '#FF5C7C',
    success: '#4ADE80',
  },
  radius: { sm: 8, md: 12, lg: 18 },
  space: (n: number) => n * 4,
} as const;

export type Theme = typeof theme;
