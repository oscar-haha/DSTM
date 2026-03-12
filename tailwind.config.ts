import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)']
      },
      colors: {
        ink: 'var(--ink)',
        bg: 'var(--bg)',
        accent: 'var(--accent)',
        accentSoft: 'var(--accent-soft)',
        sun: 'var(--sun)',
        stone: 'var(--stone)'
      },
      boxShadow: {
        card: '0 10px 30px rgba(17, 24, 39, 0.08)'
      }
    }
  },
  plugins: []
};

export default config;
