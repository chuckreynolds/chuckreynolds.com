import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import markdownTwin from './src/integrations/markdown-twin.mjs';

export default defineConfig({
  site: 'https://chuckreynolds.com',
  compressHTML: true,
  build: {
    inlineStylesheets: 'always',
  },
  image: {
    responsiveStyles: true,
  },
  integrations: [sitemap(), markdownTwin()],
});
