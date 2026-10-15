/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dbe6fe',
          200: '#bfd3fe',
          500: '#3b6fe0',
          600: '#2a56c6',
          700: '#2345a0',
          800: '#1f3b82',
          900: '#1b2f63',
        },
      },
    },
  },
  plugins: [],
};
