import { ExportTheme, ExportThemeId } from './types.js'

export const EXPORT_THEMES: Record<ExportThemeId, ExportTheme> = {
  light: {
    background: '#ffffff',
    cardFill: '#f9fafb',
    border: '#e5e7eb',
    ink: '#111827',
    muted: '#6b7280',
    faint: '#9ca3af',
    accent: '#6366f1',
    accentAlt: '#10b981',
  },
  dark: {
    background: '#111827',
    cardFill: '#1f2937',
    border: '#374151',
    ink: '#f9fafb',
    muted: '#d1d5db',
    faint: '#9ca3af',
    accent: '#818cf8',
    accentAlt: '#34d399',
  },
  'one-dark': {
    background: '#282c34',
    cardFill: '#21252b',
    border: '#3e4451',
    ink: '#abb2bf',
    muted: '#d19a66',
    faint: '#565c64',
    accent: '#61afef',
    accentAlt: '#98c379',
  },
}

export const DEFAULT_EXPORT_THEME = 'light'

export function getExportTheme(id: ExportThemeId): ExportTheme {
  return EXPORT_THEMES[id]
}
