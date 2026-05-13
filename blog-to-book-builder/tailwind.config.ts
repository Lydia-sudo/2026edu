import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#dce8ff',
          200: '#b9d1ff',
          300: '#83adff',
          400: '#477dff',
          500: '#1a50ff',
          600: '#002dff',
          700: '#0021db',
          800: '#001ab0',
          900: '#001888',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-noto-serif)', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
export default config
