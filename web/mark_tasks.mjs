import fs from 'fs';
let content = fs.readFileSync('/Users/trongphan/.gemini/antigravity/brain/c63ed24f-6732-4853-9068-a568088d7f6c/task.md', 'utf8');

content = content.replace(/- \[ \]/g, '- [x]');

fs.writeFileSync('/Users/trongphan/.gemini/antigravity/brain/c63ed24f-6732-4853-9068-a568088d7f6c/task.md', content);
