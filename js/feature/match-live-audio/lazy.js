import { createLazyFeature } from '../../engine/lazy-feature-loader.js';

/**
 * Carrega `match-live-audio` sob demanda (MP3s + Web Audio).
 * Proxy encaminha métodos/props para a instância após `import()` dinâmico.
 */
export function createLazyMatchLiveAudio() {
  const lazy = createLazyFeature(async () => {
    const { createMatchLiveAudioFeature } = await import('./index.js');
    const audio = createMatchLiveAudioFeature();
    audio.syncControls?.();
    return audio;
  });

  const api = {
    ensure: () => lazy.ensure(),
    getLoaded: () => lazy.get(),
  };

  return new Proxy(api, {
    get(target, prop) {
      if (prop in target) return target[prop];
      const inst = lazy.get();
      if (inst && prop in inst) {
        const val = inst[prop];
        return typeof val === 'function' ? val.bind(inst) : val;
      }
      return (...args) =>
        lazy.ensure().then(i => {
          const val = i?.[prop];
          return typeof val === 'function' ? val(...args) : val;
        });
    },
  });
}
