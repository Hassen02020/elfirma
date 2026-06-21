/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        elfirma: {
          green: '#2E7D32',
          darkGreen: '#1B5E20',
          gold: '#FFD700',
          lightGold: '#FFF9C4',
        }
      }
    },
  },
  plugins: [],
}
