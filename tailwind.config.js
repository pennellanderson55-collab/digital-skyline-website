/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#050506',
          900: '#0a0a0c',
          800: '#101014',
          700: '#16161c',
        },
        gold: {
          50: '#fbf6e9',
          100: '#f5ead0',
          200: '#ecd49b',
          300: '#e3bf6a',
          400: '#d4af37', // primary metallic gold
          500: '#c69b2e',
          600: '#a87f22',
          700: '#7d5d17',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'gold-gradient':
          'linear-gradient(135deg, #f5ead0 0%, #d4af37 35%, #a87f22 70%, #e3bf6a 100%)',
        'gold-sheen':
          'linear-gradient(110deg, transparent 20%, rgba(212,175,55,0.35) 50%, transparent 80%)',
        'radial-gold':
          'radial-gradient(circle at 50% 0%, rgba(212,175,55,0.18), transparent 60%)',
      },
      boxShadow: {
        gold: '0 0 0 1px rgba(212,175,55,0.25), 0 18px 50px -12px rgba(212,175,55,0.35)',
        'gold-soft': '0 0 40px -8px rgba(212,175,55,0.45)',
        card: '0 24px 70px -24px rgba(0,0,0,0.8)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0) translateX(0)' },
          '50%': { transform: 'translateY(-22px) translateX(8px)' },
        },
        sheen: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.8)', opacity: '0.7' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        scan: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(100%)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        spinSlow: {
          to: { transform: 'rotate(360deg)' },
        },
        gridDrift: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(40px)' },
        },
        corePulse: {
          '0%': { transform: 'translate(-50%, -50%) scale(0.55)', opacity: '0' },
          '10%': { opacity: '0.5' },
          '55%': { transform: 'translate(-50%, -50%) scale(2.3)', opacity: '0' },
          '100%': { transform: 'translate(-50%, -50%) scale(2.3)', opacity: '0' },
        },
        coreGlow: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        statusBlink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'floatSlow 9s ease-in-out infinite',
        sheen: 'sheen 3.5s linear infinite',
        'pulse-ring': 'pulseRing 2.4s cubic-bezier(0.2,0.6,0.3,1) infinite',
        scan: 'scan 2.6s ease-in-out infinite alternate',
        marquee: 'marquee 28s linear infinite',
        'spin-slow': 'spinSlow 22s linear infinite',
        'grid-drift': 'gridDrift 8s linear infinite',
        'core-pulse': 'corePulse 4.5s ease-out infinite',
        'core-glow': 'coreGlow 3.4s ease-in-out infinite',
        'status-blink': 'statusBlink 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
