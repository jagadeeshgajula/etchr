const loaded = new Set();

/**
 * Injects a Google Fonts stylesheet link into the given document once per family.
 * Loaded into the editable document itself so the font renders live AND persists
 * in the saved HTML (the <link> is normal page markup, not editor chrome).
 */
export function ensureGoogleFont(doc, family) {
  const key = family.toLowerCase();
  if (loaded.has(key)) return;
  loaded.add(key);
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@100;300;400;500;700;900&display=swap`;
  doc.head.appendChild(link);
}
