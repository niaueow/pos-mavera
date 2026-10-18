/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#E8BA00',
          hover: '#D4A800',
          subtle: '#FFF8DB',
          light: '#FFFCED',
        },
        ink: {
          DEFAULT: '#242424',
          muted: '#646464',
          light: '#8E8E8E',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F7F6F2',
          subtle: '#FAF9F5',
        },
        border: {
          DEFAULT: '#E6E3DA',
          strong: '#D1CDC1',
        },
        success: {
          DEFAULT: '#18794E',
          surface: '#EBF7EE',
        },
        danger: {
          DEFAULT: '#D9381E',
          surface: '#FDF0ED',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '12px',
        lg: '12px',
        xl: '16px',
        md: '8px',
        sm: '6px',
      },
      boxShadow: {
        subtle: '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)',
        card: '0 4px 12px rgba(0, 0, 0, 0.04)',
        elevated: '0 8px 24px rgba(0, 0, 0, 0.08)',
        modal: '0 20px 40px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
}
