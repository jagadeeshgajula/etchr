/**
 * Returns a debounced wrapper: calls to it collapse into a single trailing
 * invocation of `fn` after `wait` ms of silence. Used to avoid re-walking
 * document.styleSheets on every rapid selection/history change while a
 * CSS-consuming panel is open.
 */
export function debounce(fn, wait) {
  let timer = null;
  function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  }
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}
