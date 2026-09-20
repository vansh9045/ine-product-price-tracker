/** @type {import('tailwindcss').Config} */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx,html}'
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        muted: '#64748b',
      },
      borderRadius: {
        lg: '12px',
      },
    },
  },
  // No safelist: prefer Tailwind to detect used classes from source files.
  plugins: [],
};
