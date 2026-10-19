/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  safelist: ['btn-primary', 'btn-secondary', 'btn-ghost', 'btn-danger', 'btn-sm'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: { 950: '#0b1a24', 900: '#102431', 800: '#17323f', 700: '#244556', 600: '#3a5b6c' },
        paper: '#f2f4f3',
        line: '#dbe2e0',
        brand: { 50: '#e7f4f2', 100: '#c9e7e3', 200: '#9bd1cb', 500: '#12877e', 600: '#0d6f67', 700: '#0a5a54', 800: '#094a45' },
        est: {
          asignado: '#64748b',
          confirmado: '#2563a8',
          sala: '#b7791f',
          atendido: '#1b7f4b',
          ausente: '#b4372f',
          cancelado: '#8a949c',
        },
      },
      boxShadow: { card: '0 1px 0 rgba(16,36,49,.04), 0 1px 3px rgba(16,36,49,.06)' },
    },
  },
  plugins: [],
};
