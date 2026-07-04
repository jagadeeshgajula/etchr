export const ELEMENT_CATEGORIES = [
  {
    name: 'Text',
    items: [
      { tag: 'h1', label: 'Heading 1' },
      { tag: 'h2', label: 'Heading 2' },
      { tag: 'h3', label: 'Heading 3' },
      { tag: 'h4', label: 'Heading 4' },
      { tag: 'h5', label: 'Heading 5' },
      { tag: 'h6', label: 'Heading 6' },
      { tag: 'p', label: 'Paragraph' },
      { tag: 'span', label: 'Span' },
      { tag: 'blockquote', label: 'Quote' },
      { tag: 'a', label: 'Link' },
    ],
  },
  {
    name: 'Media',
    items: [
      { tag: 'img', label: 'Image' },
      { tag: 'hr', label: 'Divider' },
    ],
  },
  {
    name: 'Form',
    items: [
      { tag: 'input', label: 'Input' },
      { tag: 'textarea', label: 'Textarea' },
      { tag: 'button', label: 'Button' },
      { tag: 'label', label: 'Label' },
    ],
  },
  {
    name: 'Layout',
    items: [
      { tag: 'div', label: 'Container' },
      { tag: 'section', label: 'Section' },
      { tag: 'ul', label: 'Bullet list' },
      { tag: 'ol', label: 'Numbered list' },
      { tag: 'li', label: 'List item' },
    ],
  },
];

export const PLACEHOLDER_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160">' +
      '<rect width="100%" height="100%" fill="#e2e6ee"/>' +
      '<text x="50%" y="50%" font-family="sans-serif" font-size="16" fill="#8a93a6" ' +
      'text-anchor="middle" dominant-baseline="middle">Click to set image</text></svg>'
  );

/**
 * Creates a new element of the given tag with sensible default content,
 * ready to be inserted into the editable document.
 */
export function createDefaultElement(doc, tag) {
  const el = doc.createElement(tag);
  switch (tag) {
    case 'p':
      el.textContent = 'New paragraph. Click "Edit text" to change this.';
      break;
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      el.textContent = 'New heading';
      break;
    case 'span':
      el.textContent = 'new span';
      break;
    case 'blockquote':
      el.textContent = 'A memorable quote goes here.';
      break;
    case 'a':
      el.textContent = 'link text';
      el.setAttribute('href', '#');
      break;
    case 'div':
      el.textContent = 'New container';
      el.style.padding = '16px';
      el.style.border = '1px dashed #c3c9d4';
      break;
    case 'section':
      el.textContent = 'New section';
      el.style.padding = '24px';
      break;
    case 'ul':
    case 'ol':
      el.appendChild(makeLi(doc, 'List item one'));
      el.appendChild(makeLi(doc, 'List item two'));
      break;
    case 'li':
      el.textContent = 'List item';
      break;
    case 'img':
      el.setAttribute('src', PLACEHOLDER_IMG);
      el.setAttribute('alt', 'Placeholder image');
      el.style.maxWidth = '100%';
      el.style.display = 'block';
      break;
    case 'hr':
      break;
    case 'input':
      el.setAttribute('type', 'text');
      el.setAttribute('placeholder', 'Enter text');
      break;
    case 'textarea':
      el.setAttribute('placeholder', 'Enter text');
      el.setAttribute('rows', '3');
      break;
    case 'button':
      el.textContent = 'Button';
      break;
    case 'label':
      el.textContent = 'Label';
      break;
    default:
      el.textContent = 'New element';
  }
  return el;
}

function makeLi(doc, text) {
  const li = doc.createElement('li');
  li.textContent = text;
  return li;
}
