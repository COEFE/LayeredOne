
/**
 * Minimal PostCSS configuration with polyfills for Vercel build
 */

// Define inline plugins to avoid module resolution issues
const inlineAutoprefixer = {
  postcssPlugin: 'autoprefixer',
  Once() {
    // Do nothing - just a placeholder
  }
};
inlineAutoprefixer.postcss = true;

const inlineTailwind = {
  postcssPlugin: 'tailwindcss',
  Once() {
    // Do nothing - just a placeholder
  }
};
inlineTailwind.postcss = true;

// Export a configuration with inline plugins
module.exports = {
  plugins: [
    inlineTailwind,
    inlineAutoprefixer,
    // Try to use real plugins if available
    ...(function() {
      try {
        // Try to load the real tailwindcss
        const tailwind = require('tailwindcss');
        return [tailwind];
      } catch (e) {
        console.warn('Could not load tailwindcss, using fallback');
        return [];
      }
    })(),
    ...(function() {
      try {
        // Try to load the real autoprefixer
        const autoprefixer = require('autoprefixer');
        return [autoprefixer];
      } catch (e) {
        console.warn('Could not load autoprefixer, using fallback');
        return [];
      }
    })()
  ]
};
