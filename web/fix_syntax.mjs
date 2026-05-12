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

    // Fix trailing comma before SelectItem
    content = content.replace(/,\s*SelectItem\s*\}/g, ' SelectItem }');
    // Ensure it is separated from the previous item
    content = content.replace(/(\w)\s*SelectItem/g, '$1, SelectItem');
    // Also fix cases where a newline and comma happened
    content = content.replace(/\n\s*,\s*SelectItem\s*\}/g, '\n    SelectItem\n}');
    
    fs.writeFileSync(file, content);
}
console.log('Fixed syntax errors');
