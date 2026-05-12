import fs from 'fs';

const files = [
  'src/pages/Dashboard.jsx',
  'src/pages/Budgets.jsx',
  'src/pages/Categories.jsx',
  'src/pages/Goals.jsx',
  'src/pages/Settings.jsx',
  'src/pages/Debts.jsx',
  'src/pages/Wallets.jsx',
  'src/pages/TravelTracker.jsx'
];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');

    // Remove GlassCard if it was incorrectly added to other imports
    content = content.replace(/,\s*GlassCard\s*}/g, '}');
    content = content.replace(/\{\s*GlassCard\s*,/g, '{');
    content = content.replace(/\{\s*GlassCard\s*\}/g, '{}');

    // Add GlassCard to the @/components/ui import
    if (content.includes("@/components/ui")) {
        content = content.replace(/(import\s*\{)([^}]*)(\}\s*from\s*['"]@\/components\/ui['"])/, (match, p1, p2, p3) => {
            if (p2.includes("GlassCard")) return match;
            return `${p1}${p2}, GlassCard ${p3}`;
        });
    } else {
        // If there is no @/components/ui import, add it
        content = `import { GlassCard } from '@/components/ui';\n` + content;
    }

    fs.writeFileSync(file, content);
    console.log(`${file} fixed imports`);
}
