/**
 * Carrega features pesadas (calendário, mercado UI) sob demanda.
 */

/**
 * @template T
 * @param {() => Promise<T>} factory
 */
export function createLazyFeature(factory) {
  /** @type {T | null} */
  let instance = null;
  /** @type {Promise<T> | null} */
  let promise = null;

  const ensure = () => {
    if (instance) return Promise.resolve(instance);
    if (!promise) {
      promise = factory().then(value => {
        instance = value;
        return value;
      });
    }
    return promise;
  };

  return {
    get() {
      return instance;
    },
    ensure,
    /** @param {keyof T} method */
    call(method, ...args) {
      return ensure().then(inst => {
        const fn = inst?.[method];
        if (typeof fn !== 'function') return undefined;
        return fn(...args);
      });
    },
  };
}
