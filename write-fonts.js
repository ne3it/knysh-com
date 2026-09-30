const fs = require('fs');

const regular = fs.readFileSync('E:/knysh.com/DejaVuSans.b64', 'utf8').trim();
const bold = fs.readFileSync('E:/knysh.com/DejaVuSans-Bold.b64', 'utf8').trim();

const content = `// DejaVu Sans font Base64 encoded TTF files for jsPDF
// Generated from https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37/ttf/

export const DEJAVU_SANS_REGULAR_BASE64 = \`${regular}\`;

export const DEJAVU_SANS_BOLD_BASE64 = \`${bold}\`;
`;

fs.writeFileSync('E:/knysh.com/src/lib/fonts.ts', content);
console.log('Fonts file written, size:', fs.statSync('E:/knysh.com/src/lib/fonts.ts').size, 'bytes');