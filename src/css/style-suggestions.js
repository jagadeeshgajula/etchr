// Element-aware, click-to-apply style presets. Each suggestion is a set of
// declarations applied to the selected element (as one undoable batch).

const d = (obj) => Object.entries(obj).map(([property, value]) => ({ property, value }));

const HEADING = [
  { label: 'Bold & dark', decl: d({ 'font-weight': '800', color: '#1a1a1a' }) },
  { label: 'Underline accent', decl: d({ 'border-bottom': '3px solid #2f6fed', 'padding-bottom': '6px', display: 'inline-block' }) },
  { label: 'Uppercase spaced', decl: d({ 'text-transform': 'uppercase', 'letter-spacing': '2px', 'font-size': '18px' }) },
  { label: 'Gradient text', decl: d({ 'background-image': 'linear-gradient(90deg,#2f6fed,#8a5cf6)', '-webkit-background-clip': 'text', 'background-clip': 'text', '-webkit-text-fill-color': 'transparent', color: 'transparent' }) },
  { label: 'Centered', decl: d({ 'text-align': 'center' }) },
  { label: 'Left bar accent', decl: d({ 'border-left': '5px solid #2f6fed', 'padding-left': '12px' }) },
  { label: 'Hero size', decl: d({ 'font-size': '44px', 'line-height': '1.1', 'font-weight': '800' }) },
  { label: 'Soft shadow', decl: d({ 'text-shadow': '0 2px 6px rgba(0,0,0,0.25)' }) },
  { label: 'Brand blue', decl: d({ color: '#2f6fed' }) },
  { label: 'Badge', decl: d({ background: '#eef3ff', color: '#2f6fed', padding: '6px 14px', 'border-radius': '999px', display: 'inline-block', 'font-size': '16px' }) },
];

const TEXT = [
  { label: 'Muted gray', decl: d({ color: '#6b7280' }) },
  { label: 'Readable large', decl: d({ 'font-size': '18px', 'line-height': '1.7' }) },
  { label: 'Justified', decl: d({ 'text-align': 'justify' }) },
  { label: 'Highlight', decl: d({ 'background-color': '#fff3bf', padding: '2px 6px', 'border-radius': '4px' }) },
  { label: 'Italic soft', decl: d({ 'font-style': 'italic', color: '#555' }) },
  { label: 'Letter spaced', decl: d({ 'letter-spacing': '1px' }) },
  { label: 'Narrow column', decl: d({ 'max-width': '520px' }) },
  { label: 'Lead paragraph', decl: d({ 'font-size': '20px', color: '#374151', 'line-height': '1.6' }) },
  { label: 'Caption', decl: d({ 'font-size': '13px', color: '#9ca3af' }) },
  { label: 'Centered', decl: d({ 'text-align': 'center' }) },
];

const BUTTON = [
  { label: 'Primary', decl: d({ background: '#2f6fed', color: '#fff', border: 'none', padding: '10px 18px', 'border-radius': '8px', cursor: 'pointer' }) },
  { label: 'Pill', decl: d({ 'border-radius': '999px', padding: '10px 22px' }) },
  { label: 'Outline', decl: d({ background: 'transparent', color: '#2f6fed', border: '2px solid #2f6fed', padding: '9px 18px', 'border-radius': '8px', cursor: 'pointer' }) },
  { label: 'Gradient', decl: d({ 'background-image': 'linear-gradient(135deg,#2f6fed,#8a5cf6)', color: '#fff', border: 'none', padding: '10px 18px', 'border-radius': '8px', cursor: 'pointer' }) },
  { label: 'Large', decl: d({ 'font-size': '18px', padding: '14px 28px' }) },
  { label: 'Shadowed', decl: d({ 'box-shadow': '0 4px 14px rgba(47,111,237,0.4)' }) },
  { label: 'Danger', decl: d({ background: '#e53935', color: '#fff', border: 'none', padding: '10px 18px', 'border-radius': '8px', cursor: 'pointer' }) },
  { label: 'Success', decl: d({ background: '#43a047', color: '#fff', border: 'none', padding: '10px 18px', 'border-radius': '8px', cursor: 'pointer' }) },
  { label: 'Ghost', decl: d({ background: 'transparent', border: 'none', color: '#374151', padding: '8px 12px', cursor: 'pointer' }) },
  { label: 'Full width', decl: d({ width: '100%', display: 'block' }) },
];

const INPUT = [
  { label: 'Rounded', decl: d({ border: '1px solid #cbd5e1', 'border-radius': '8px', padding: '10px 12px' }) },
  { label: 'Underline only', decl: d({ border: 'none', 'border-bottom': '2px solid #cbd5e1', 'border-radius': '0', padding: '8px 2px' }) },
  { label: 'Pill', decl: d({ 'border-radius': '999px', padding: '10px 18px', border: '1px solid #cbd5e1' }) },
  { label: 'Focus glow', decl: d({ border: '1px solid #2f6fed', 'box-shadow': '0 0 0 3px rgba(47,111,237,0.2)', 'border-radius': '8px', padding: '10px 12px' }) },
  { label: 'Roomy', decl: d({ padding: '14px 16px', 'font-size': '16px' }) },
  { label: 'Soft gray', decl: d({ background: '#f3f4f6', border: '1px solid #e5e7eb', 'border-radius': '8px', padding: '10px 12px' }) },
  { label: 'Error', decl: d({ border: '2px solid #e53935', 'border-radius': '8px', padding: '10px 12px' }) },
  { label: 'Success', decl: d({ border: '2px solid #43a047', 'border-radius': '8px', padding: '10px 12px' }) },
  { label: 'Full width', decl: d({ width: '100%' }) },
  { label: 'Monospace', decl: d({ 'font-family': 'Consolas, monospace' }) },
];

const IMAGE = [
  { label: 'Rounded', decl: d({ 'border-radius': '12px' }) },
  { label: 'Circle', decl: d({ 'border-radius': '50%' }) },
  { label: 'Bordered', decl: d({ border: '4px solid #fff', 'box-shadow': '0 0 0 1px #e5e7eb' }) },
  { label: 'Card shadow', decl: d({ 'border-radius': '12px', 'box-shadow': '0 8px 24px rgba(0,0,0,0.18)' }) },
  { label: 'Small', decl: d({ width: '160px', height: 'auto' }) },
  { label: 'Medium', decl: d({ width: '320px', height: 'auto' }) },
  { label: 'Large', decl: d({ width: '640px', height: 'auto' }) },
  { label: 'Full width', decl: d({ width: '100%', height: 'auto' }) },
  { label: 'Grayscale', decl: d({ filter: 'grayscale(100%)' }) },
  { label: 'Thumbnail', decl: d({ width: '120px', height: '120px', 'object-fit': 'cover', 'border-radius': '8px' }) },
];

const CONTAINER = [
  { label: 'Card', decl: d({ border: '1px solid #e5e7eb', 'border-radius': '12px', padding: '20px', 'box-shadow': '0 4px 14px rgba(0,0,0,0.08)', background: '#fff' }) },
  { label: 'Bordered box', decl: d({ border: '2px solid #cbd5e1', 'border-radius': '8px', padding: '16px' }) },
  { label: 'Light panel', decl: d({ background: '#f8fafc', 'border-radius': '10px', padding: '20px' }) },
  { label: 'Gradient', decl: d({ 'background-image': 'linear-gradient(135deg,#2f6fed,#8a5cf6)', color: '#fff', padding: '24px', 'border-radius': '12px' }) },
  { label: 'Rounded', decl: d({ 'border-radius': '16px', overflow: 'hidden' }) },
  { label: 'Center content', decl: d({ display: 'flex', 'align-items': 'center', 'justify-content': 'center', gap: '12px' }) },
  { label: 'Padded', decl: d({ padding: '32px' }) },
  { label: 'Elevated', decl: d({ 'box-shadow': '0 12px 32px rgba(0,0,0,0.15)', 'border-radius': '12px' }) },
  { label: 'Banner', decl: d({ background: '#eef3ff', 'border-radius': '999px', padding: '14px 28px', 'text-align': 'center' }) },
  { label: 'Hero', decl: d({ padding: '64px 24px', 'text-align': 'center', 'background-image': 'linear-gradient(135deg,#1e3a8a,#2f6fed)', color: '#fff' }) },
];

const LINK = [
  { label: 'Blue underline', decl: d({ color: '#2f6fed', 'text-decoration': 'underline' }) },
  { label: 'No underline', decl: d({ 'text-decoration': 'none' }) },
  { label: 'Button-like', decl: d({ background: '#2f6fed', color: '#fff', padding: '8px 16px', 'border-radius': '8px', 'text-decoration': 'none', display: 'inline-block' }) },
  { label: 'Bold colored', decl: d({ 'font-weight': '700', color: '#2f6fed' }) },
  { label: 'Muted', decl: d({ color: '#6b7280', 'text-decoration': 'none' }) },
  { label: 'Pill badge', decl: d({ background: '#eef3ff', color: '#2f6fed', padding: '4px 12px', 'border-radius': '999px', 'text-decoration': 'none' }) },
  { label: 'Uppercase small', decl: d({ 'text-transform': 'uppercase', 'font-size': '12px', 'letter-spacing': '1px' }) },
  { label: 'Large', decl: d({ 'font-size': '18px' }) },
  { label: 'Outlined', decl: d({ border: '1px solid #2f6fed', color: '#2f6fed', padding: '6px 14px', 'border-radius': '8px', 'text-decoration': 'none', display: 'inline-block' }) },
  { label: 'Underline thick', decl: d({ 'text-decoration': 'underline', 'text-decoration-thickness': '3px' }) },
];

const LIST = [
  { label: 'No bullets', decl: d({ 'list-style': 'none', padding: '0' }) },
  { label: 'Spaced items', decl: d({ 'line-height': '2' }) },
  { label: 'Indented', decl: d({ 'padding-left': '28px' }) },
  { label: 'Colored markers', decl: d({ color: '#2f6fed' }) },
  { label: 'Large text', decl: d({ 'font-size': '18px' }) },
  { label: 'Card', decl: d({ background: '#f8fafc', 'border-radius': '8px', padding: '12px 16px' }) },
  { label: 'Bordered', decl: d({ border: '1px solid #e5e7eb', 'border-radius': '8px', padding: '12px' }) },
  { label: 'Inline row', decl: d({ display: 'flex', gap: '16px', 'list-style': 'none', padding: '0' }) },
  { label: 'Compact', decl: d({ 'line-height': '1.3', margin: '0' }) },
  { label: 'Muted', decl: d({ color: '#6b7280' }) },
];

const GENERIC = [
  { label: 'Rounded corners', decl: d({ 'border-radius': '10px' }) },
  { label: 'Soft shadow', decl: d({ 'box-shadow': '0 4px 14px rgba(0,0,0,0.12)' }) },
  { label: 'Add padding', decl: d({ padding: '16px' }) },
  { label: 'Light border', decl: d({ border: '1px solid #e5e7eb' }) },
  { label: 'Muted text', decl: d({ color: '#6b7280' }) },
  { label: 'Centered text', decl: d({ 'text-align': 'center' }) },
];

const CATEGORY_BY_TAG = {
  h1: HEADING, h2: HEADING, h3: HEADING, h4: HEADING, h5: HEADING, h6: HEADING,
  p: TEXT, span: TEXT, blockquote: TEXT, label: TEXT,
  button: BUTTON,
  input: INPUT, textarea: INPUT, select: INPUT,
  img: IMAGE,
  div: CONTAINER, section: CONTAINER, article: CONTAINER, header: CONTAINER, footer: CONTAINER, main: CONTAINER,
  a: LINK,
  ul: LIST, ol: LIST, li: LIST,
};

/** Returns the category name + suggestions for the given element. */
export function getSuggestionsForElement(el) {
  const tag = el.tagName.toLowerCase();
  const specific = CATEGORY_BY_TAG[tag] || CONTAINER;
  return { tag, suggestions: [...specific, ...GENERIC] };
}
