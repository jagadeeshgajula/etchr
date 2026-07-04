import { cls, ATTR_IGNORE } from '../core/constants.js';
import { createEl } from './dom-helpers.js';

export function createToastHost(editorRoot) {
  const doc = editorRoot.ownerDocument;
  const host = createEl(doc, 'div', { className: cls('toast-host'), attrs: { [ATTR_IGNORE]: '' } });
  editorRoot.appendChild(host);

  function show(message, { type = 'info', duration = 3500 } = {}) {
    const toast = createEl(doc, 'div', { className: `${cls('toast')} ${cls('toast-' + type)}`, attrs: { [ATTR_IGNORE]: '', role: 'status' }, text: message });
    host.appendChild(toast);
    // Force a reflow so the enter transition actually plays, then trigger it.
    void toast.offsetWidth;
    toast.classList.add(cls('toast-visible'));
    const remove = () => {
      toast.classList.remove(cls('toast-visible'));
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
      setTimeout(() => toast.remove(), 400); // fallback if transitionend doesn't fire
    };
    const timer = setTimeout(remove, duration);
    toast.addEventListener('click', () => {
      clearTimeout(timer);
      remove();
    });
  }

  return {
    success: (msg, opts) => show(msg, { ...opts, type: 'success' }),
    error: (msg, opts) => show(msg, { ...opts, type: 'error', duration: (opts && opts.duration) || 6000 }),
    info: (msg, opts) => show(msg, { ...opts, type: 'info' }),
  };
}
