import fs from 'fs';
import path from 'path';

const files = [
  'src/pages/Dashboard.jsx',
  'src/pages/Budgets.jsx',
  'src/pages/Categories.jsx',
  'src/pages/Goals.jsx',
  'src/pages/Settings.jsx',
  'src/pages/Debts.jsx',
  'src/pages/Wallets.jsx'
];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');

    // Add GlassCard to the ui imports
    if (content.includes("@/components/ui") && !content.includes("GlassCard") && content.match(/import\s*\{[^}]*\}\s*from\s*['"]@\/components\/ui['"]/)) {
        content = content.replace(/(import\s*\{)([^}]*)(\}\s*from\s*['"]@\/components\/ui['"])/, (match, p1, p2, p3) => {
            return `${p1}${p2}, GlassCard ${p3}`;
        });
    }

    // Ensure the local const GlassCard is removed
    content = content.replace(/const GlassCard = \(\{ children, className = "" \}\) => \([\s\S]*?<\/div>\n\);\n\n/g, '');

    // Fix Recharts Tooltip background
    content = content.replace(/background: 'rgba\(255,\s*255,\s*255,\s*0\.95\)'/g, "background: 'var(--tooltip-bg, rgba(255,255,255,0.95))'");
    content = content.replace(/background: '#fff'/g, "background: 'var(--tooltip-bg, #fff)'");

    fs.writeFileSync(file, content);
    console.log(`${file} fixed`);
}
