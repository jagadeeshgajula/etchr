export const WEB_SAFE_FONTS = [
  'Arial, Helvetica, sans-serif',
  'Georgia, serif',
  '"Times New Roman", Times, serif',
  '"Courier New", Courier, monospace',
  'Verdana, Geneva, sans-serif',
  'Tahoma, Geneva, sans-serif',
  '"Trebuchet MS", Helvetica, sans-serif',
];

export const GOOGLE_FONTS = ['Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins'];

export const CONTAINER_TAGS = new Set(['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'section', 'article', 'header', 'footer', 'main', 'li', 'ul', 'ol', 'a', 'button', 'blockquote']);

export const DEFAULT_DEBOUNCE_MS = 150;

export function createConfig(overrides = {}) {
  return {
    saveEndpoint: '/save-page',
    onSave: null,
    // Optional async hook: (File) => Promise<string url>. When provided, local
    // image uploads are routed through it (e.g. to a real asset store) instead of
    // being embedded as a data URL. Falls back to a FileReader data URL if absent.
    onImageUpload: null,
    // Optional async hook for natural-language styling:
    //   (text, { tag, currentStyles }) => Promise<{property, value}[]>
    // When provided, the "describe a style" box routes to it (e.g. an LLM on your
    // backend) for true understanding. Falls back to the built-in phrase parser.
    onAiStyle: null,
    // Whether to show a native confirm() dialog before saving. Defaults to true
    // only for the standalone file-write path (no custom onSave); a React host
    // supplying its own onSave usually wants to control confirmation itself, but
    // this can be set explicitly either way.
    confirmBeforeSave: undefined,
    startInEditMode: false,
    debounceMs: DEFAULT_DEBOUNCE_MS,
    // Resize handles on the selection outline, and whether resizing an
    // element auto-injects reflow fixes + @media breakpoint rules so layout
    // holds up across viewport sizes without hand-written responsive CSS.
    enableResize: true,
    autoResponsiveCss: true,
    resizeMinSize: 24,
    responsiveBreakpoints: ['tablet', 'mobile'],
    fontFamilies: [...WEB_SAFE_FONTS],
    googleFonts: [...GOOGLE_FONTS],
    containerTags: CONTAINER_TAGS,
    ...overrides,
  };
}
