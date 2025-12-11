export enum ThemeMode {
  LIGHT = 'light',
  DARK = 'dark',
  SEPIA = 'sepia',
  HIGH_CONTRAST = 'high-contrast', // Yellow on Black
  INK = 'ink', // E-Ink / Paper style
}

export enum FontFamily {
  SANS = 'sans',
  SERIF = 'serif',
  MONO = 'mono',
  SYSTEM = 'system-ui',
}

export interface Highlight {
  start: number;
  end: number;
  text: string;
  id: string;
}

export interface ReaderSettings {
  fontSize: number; // in pixels (base)
  lineHeight: number; // unitless (e.g., 1.5)
  letterSpacing: number; // in em
  theme: ThemeMode;
  fontFamily: FontFamily;
  isFocusMode: boolean; // Dims non-active paragraphs
  isLoupeActive: boolean; // Cursor follower magnifier
  isHoverZoom: boolean; // Hovering a paragraph scales it up slightly
  isBionicReading: boolean; // Highlights initial letters of words
  autoScrollSpeed: number; // 0 = off
  speechVoiceURI: string; // Preferred voice for TTS
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 22,
  lineHeight: 1.8,
  letterSpacing: 0.02,
  theme: ThemeMode.LIGHT,
  fontFamily: FontFamily.SANS,
  isFocusMode: false,
  isLoupeActive: false,
  isHoverZoom: true,
  isBionicReading: false,
  autoScrollSpeed: 0,
  speechVoiceURI: '',
};