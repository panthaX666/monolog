import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Regenerate icons with: npm run icons
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#000000' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#000000' } },
  },
  images: ['public/favicon.svg'],
});
