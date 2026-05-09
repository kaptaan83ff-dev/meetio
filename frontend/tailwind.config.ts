import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'sun-yellow': '#ffe500',
        'ink-black': '#0a0a0a',
        'electric-pink': '#ff4f8b',
        'neon-lime': '#c6ff3d',
        'royal-blue': '#0052ff',
        'cream-canvas': '#fff1e6',
        'ghost-white': '#ffffff',
      },
      fontFamily: {
        display: ['"Archivo Black"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'hard': '4px 4px 0px 0px #0a0a0a',
        'hard-hover': '7px 7px 0px 0px #0a0a0a',
        'hard-active': '1px 1px 0px 0px #0a0a0a',
        'hard-yellow': '4px 4px 0px 0px #ffe500',
        'hard-yellow-hover': '7px 7px 0px 0px #ffe500',
        'hard-yellow-active': '1px 1px 0px 0px #ffe500',
      },
    },
  },
  plugins: [],
}

export default config
