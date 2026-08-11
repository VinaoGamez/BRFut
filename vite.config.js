import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const isGithubPages = process.env.GITHUB_PAGES === 'true';

/** Mercado ativo em todos os builds (local + GitHub Pages). */
const enableTransfers = process.env.BRFUT_DISABLE_TRANSFERS !== 'true' && process.env.MATCHDAY_DISABLE_TRANSFERS !== 'true';
/** Origem estadual / campeonato estadual — local e GitHub Pages (opt-out via env). */
const enableStateLeague = process.env.BRFUT_DISABLE_STATE_LEAGUE !== 'true' && process.env.MATCHDAY_DISABLE_STATE_LEAGUE !== 'true';

/**
 * A VPS usa o cookie HTTPS `__Host-brfut_session`. Em desenvolvimento, a
 * resposta passa pelo Vite em HTTP; navegadores descartam esse cookie porque
 * o prefixo `__Host-` exige `Secure`. Convertemos somente no proxy local para
 * o cookie alternativo que a própria API já reconhece.
 */
export function rewriteLocalSessionCookie(value) {
  return String(value || '')
    .replace(/^__Host-brfut_session=/i, 'brfut_session=')
    .replace(/;\s*Domain=[^;]+/gi, '')
    .replace(/;\s*Secure\b/gi, '')
    .replace(/;\s*SameSite=None\b/gi, '; SameSite=Lax');
}

export default defineConfig({
  root: '.',
  base: './',
  define: {
    __BRFUT_ENABLE_TRANSFERS__: JSON.stringify(enableTransfers),
    __BRFUT_ENABLE_STATE_LEAGUE__: JSON.stringify(enableStateLeague),
    __MATCHDAY_ENABLE_TRANSFERS__: JSON.stringify(enableTransfers),
    __MATCHDAY_ENABLE_STATE_LEAGUE__: JSON.stringify(enableStateLeague),
    __BRFUT_API_ORIGIN__: JSON.stringify(process.env.BRFUT_API_ORIGIN || ''),
    // Falha fechada em todos os ambientes. Somente um opt-out local explícito
    // pode desativar a autenticação durante manutenção isolada.
    __BRFUT_AUTH_REQUIRED__: JSON.stringify(process.env.BRFUT_AUTH_REQUIRED !== 'false'),
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
              nationalTeamOffersLab: resolve(__dirname, 'national-team-offers-lab.html'),
              seasonSummaryLab: resolve(__dirname, 'season-summary-lab.html'),
              transferHistoryCardLab: resolve(__dirname, 'transfer-history-card-lab.html'),
              storageDiag: resolve(__dirname, 'storage-diag.html'),
            }),
      },
    },
  },
  server: {
    port: 5080,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.BRFUT_LOCAL_API_TARGET || 'https://api.brfut.com.br',
        changeOrigin: false,
        secure: true,
        configure(proxy) {
          proxy.on('proxyReq', (proxyReq, req) => {
            // A VPS deve emitir o cookie local (SameSite=Lax, sem Secure) para
            // que o login funcione em http://localhost e no IP da rede local.
            proxyReq.setHeader('host', req.headers.host || '127.0.0.1:5080');
            proxyReq.setHeader('x-forwarded-proto', 'http');
            proxyReq.removeHeader('origin');
          });
          proxy.on('proxyRes', proxyRes => {
            const cookies = proxyRes.headers['set-cookie'];
            if (!cookies) return;
            proxyRes.headers['set-cookie'] = cookies.map(rewriteLocalSessionCookie);
          });
        },
      },
    },
  },
});
