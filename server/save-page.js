import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * Builds the /save-page Express handler, scoped to `demoRoot`.
 * The requested `path` query param is resolved against demoRoot and rejected
 * if it would escape that directory or doesn't point at an .html/.htm file —
 * the standard guard against a crafted path writing outside the intended folder.
 */
export function createSavePageHandler(demoRoot) {
  return async function savePageHandler(req, res) {
    const requested = req.query.path;
    if (typeof requested !== 'string' || !requested) {
      return res.status(400).json({ ok: false, error: 'Missing "path" query parameter.' });
    }

    // Strip any leading slash so path.resolve treats it as relative to demoRoot,
    // not as an absolute filesystem path.
    const relative = requested.replace(/^\/+/, '');
    const resolved = path.resolve(demoRoot, relative);

    if (resolved !== demoRoot && !resolved.startsWith(demoRoot + path.sep)) {
      return res.status(400).json({ ok: false, error: 'Path escapes the allowed directory.' });
    }
    if (!/\.html?$/i.test(resolved)) {
      return res.status(400).json({ ok: false, error: 'Only .html/.htm files may be saved.' });
    }

    const html = req.body;
    if (typeof html !== 'string' || !html.trim()) {
      return res.status(400).json({ ok: false, error: 'Empty or missing request body.' });
    }

    try {
      await fs.writeFile(resolved, html, 'utf8');
      res.json({ ok: true, path: path.relative(demoRoot, resolved) });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Could not write file: ' + err.message });
    }
  };
}
