import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4fa',
          100: '#d9e3f2',
          600: '#1e3a66',
          700: '#16294a',
          800: '#0f1c33',
          900: '#0a1322',
        },
        accent: {
          500: '#0891b2',
          600: '#0e7490',
        },
      },
    },
  },
  plugins: [],
}

export default config
