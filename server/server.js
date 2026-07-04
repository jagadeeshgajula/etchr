import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSavePageHandler } from './save-page.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEMO_ROOT = path.join(ROOT, 'demo');

const app = express();

app.use('/dist', express.static(path.join(ROOT, 'dist')));
app.use(express.static(DEMO_ROOT));

// Raw HTML body, matching what save-client.js sends (Content-Type: text/html).
app.post('/save-page', express.text({ type: 'text/html', limit: '5mb' }), createSavePageHandler(DEMO_ROOT));

const PORT = process.env.PORT || 5173;
app.listen(PORT, () => {
  console.log(`Visual editor demo server running at http://localhost:${PORT}/demo.html`);
});
