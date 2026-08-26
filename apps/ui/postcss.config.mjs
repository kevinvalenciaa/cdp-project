/**
 * Object form rather than the string-array shorthand: Next accepts both, but
 * the Vite version vitest runs on only understands this one and otherwise
 * fails to load the config at all.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
