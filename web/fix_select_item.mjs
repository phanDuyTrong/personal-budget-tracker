import fs from 'fs';

const files = [
  'src/pages/Dashboard.jsx',
  'src/pages/Budgets.jsx',
  'src/pages/Categories.jsx',
  'src/pages/Goals.jsx',
  'src/pages/Settings.jsx',
  'src/pages/Debts.jsx',
  'src/pages/Wallets.jsx',
  'src/pages/TravelTracker.jsx',
  'src/pages/Transactions.jsx'
];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');

    if (content.includes('ListBoxItem as SelectItem')) {
        // Remove the incorrect import
        content = content.replace(/import\s*\{\s*ListBoxItem\s*as\s*SelectItem\s*\}\s*from\s*['"]@heroui\/react\/list-box-item['"];?\n?/g, '');
        content = content.replace(/import\s*\{\s*ListBoxItem\s*as\s*SelectItem\s*\}\s*from\s*['"]@heroui\/list-box['"];?\n?/g, '');

        // Add SelectItem to the existing @heroui/react import
        if (content.includes('@heroui/react"')) {
            content = content.replace(/(import\s*\{)([^}]*)(\}\s*from\s*["']@heroui\/react["'])/, (match, p1, p2, p3) => {
                if (p2.includes('SelectItem')) return match;
                return `${p1}${p2}, SelectItem ${p3}`;
            });
        } else {
            content = `import { SelectItem } from "@heroui/react";\n` + content;
        }

        fs.writeFileSync(file, content);
        console.log(`Fixed SelectItem in ${file}`);
    }
}
