import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F4F7FB',
        card: '#FFFFFF',
        borde: '#E3E9F2',
        navy: { DEFAULT: '#00095B', deep: '#000538', soft: '#1B2A78' },
        tinta: { DEFAULT: '#17203A', suave: '#41506F', tenue: '#7788A6' },
        azure: { DEFAULT: '#2B5CE6', claro: '#7FA5F6', tenue: '#CFE0FF' },
        rojo: { DEFAULT: '#D91F26', claro: '#F2A0A3', tenue: '#FBDDDE' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        tarjeta: '0 1px 2px rgba(23,32,58,.04), 0 1px 3px rgba(23,32,58,.06)',
      },
    },
  },
  plugins: [],
};
export default config;
