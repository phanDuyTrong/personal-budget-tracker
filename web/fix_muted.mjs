import fs from 'fs';
import path from 'path';

const files = [
  'src/components/ui/DatePicker.jsx',
  'src/components/layout/AppShell.jsx',
  'src/pages/Budgets.jsx',
  'src/pages/Categories.jsx',
  'src/pages/Transactions.jsx'
];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');

    // Fix bg-muted/40 in table rows and lists
    content = content.replace(/hover:bg-muted\/40/g, 'hover:bg-neutral-100 dark:hover:bg-neutral-800/50');
    content = content.replace(/bg-muted\/40/g, 'bg-neutral-50 dark:bg-neutral-800/30');
    
    // Fix bg-muted/50 in table headers
    content = content.replace(/bg-muted\/50/g, 'bg-neutral-100/50 dark:bg-neutral-800/50');

    // Fix bg-muted in general elements (mostly AppShell and DatePicker)
    content = content.replace(/hover:bg-muted/g, 'hover:bg-neutral-100 dark:hover:bg-neutral-800');
    content = content.replace(/bg-muted /g, 'bg-neutral-100 dark:bg-neutral-800 ');

    // Fix border-border to border-neutral-200 dark:border-neutral-800
    content = content.replace(/border-border\/50/g, 'border-neutral-200 dark:border-neutral-800');
    content = content.replace(/border-border\/30/g, 'border-neutral-200 dark:border-neutral-800');

    fs.writeFileSync(file, content);
    console.log(`${file} fixed muted classes`);
}
