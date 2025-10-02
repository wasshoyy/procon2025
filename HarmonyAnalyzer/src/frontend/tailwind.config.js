/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './public/**/*.{html,js}',    // public 内の HTML / JS
    './private/**/*.{html,js}',   // private 内の HTML / JS
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
