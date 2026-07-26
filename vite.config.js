import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const githubPagesBase = repoName ? `/${repoName}/` : './';
const isGithubPages = process.env.GITHUB_PAGES === 'true';

/** Mercado ativo em todos os builds (local + GitHub Pages). */
const enableTransfers = process.env.MATCHDAY_DISABLE_TRANSFERS !== 'true';
/** Origem estadual / campeonato estadual — só build local até validação. */
const enableStateLeague = !isGithubPages;

export default defineConfig({
  root: '.',
  base: isGithubPages ? githubPagesBase : './',
  define: {
    __MATCHDAY_ENABLE_TRANSFERS__: JSON.stringify(enableTransfers),
    __MATCHDAY_ENABLE_STATE_LEAGUE__: JSON.stringify(enableStateLeague),
  },
  plugins: [
    {
      name: 'inject-build-time',
      transformIndexHtml(html) {
        const stamp = new Date().toISOString();
        if (html.includes('name="build-time"')) {
          return html.replace(
            /(<meta name="build-time" content=")[^"]*(")/,
            `$1${stamp}$2`,
          );
        }
        return html.replace('<head>', `<head>\n  <meta name="build-time" content="${stamp}">`);
      },
    },
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules') && id.includes('/js/')) {
            if (id.includes('/feature/youth-academy/') || id.includes('/engine/youth-academy.js')) {
              return 'youth-academy';
            }
            if (id.includes('/core/release-notes.js')) return 'release-notes';
            if (id.includes('/feature/calendar-view/')) return 'calendar-view';
            if (id.includes('/feature/transfers/')) return 'transfers-ui';
            if (id.includes('/feature/match-live-ui/') || id.includes('/feature/match-live-audio/')) {
              return 'match-live';
            }
            if (id.includes('/lab/player-card-system.js')) return 'player-cards';
          }
        },
      },
      input: {
        main: resolve(__dirname, 'index.html'),
        home: resolve(__dirname, 'home.html'),
        ...(isGithubPages
          ? {}
          : {
              cardLab: resolve(__dirname, 'card-lab.html'),
              cardPreview: resolve(__dirname, 'card-preview.html'),
              teamLab: resolve(__dirname, 'team-lab.html'),
            }),
      },
    },
  },
  server: {
    port: 5080,
    strictPort: true,
  },
});
