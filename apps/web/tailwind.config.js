/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        lane: {
          user: '#FFC21A',
          api: '#1E9BFF',
          model: '#FF9F1C',
        },
      },
    },
  },
  plugins: [],
};
