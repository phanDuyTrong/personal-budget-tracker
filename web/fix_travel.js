const fs = require('fs');
let content = fs.readFileSync('src/pages/TravelTracker.jsx', 'utf8');

// Undo the sed mistake
content = content.replace(/import \{ GlassCard, /g, 'import { ');

// Add GlassCard to the ui imports
content = content.replace(/import \{ \n    AmountDisplay, \n    useToast \n\} from '@\/components\/ui';/g, "import { \n    AmountDisplay, \n    useToast,\n    GlassCard\n} from '@/components/ui';");

// Make sure GlassCard is imported if the above didn't match perfectly
if (!content.includes('GlassCard\n} from \'@/components/ui\'')) {
    content = content.replace(/import \{([^\}]+)\} from '@\/components\/ui';/, (match, p1) => {
        return `import {${p1}, GlassCard } from '@/components/ui';`;
    });
}

// Ensure the local const GlassCard is removed
content = content.replace(/const GlassCard = \(\{ children, className = "" \}\) => \(\n    <div className=\{`glass-card backdrop-blur-xl rounded-3xl p-6 shadow-sm \$\{className\}`\}>\n        \{children\}\n    <\/div>\n\);\n\n/g, '');

// Fix bg-primary
content = content.replace(/className="bg-primary text-white border-none shadow-xl shadow-primary\/20 p-8 rounded-3xl relative overflow-hidden flex flex-col justify-end min-h-\[160px\]"/g, 'className="glass-card bg-primary dark:bg-primary-500\/20 text-white border-none shadow-xl shadow-primary\/20 dark:shadow-none p-8 rounded-3xl relative overflow-hidden flex flex-col justify-end min-h-[160px]"');

// Fix bg-muted/40 in list
content = content.replace(/bg-muted\/40 border border-border\/30 hover:scale-\[1.01\]/g, 'bg-neutral-50\/50 dark:bg-white\/5 border border-neutral-200 dark:border-white\/10 hover:scale-[1.01]');

// Fix Recharts Tooltip
content = content.replace(/background: 'rgba\(255,255,255,0\.95\)'/g, "background: 'var(--tooltip-bg, rgba(255,255,255,0.95))'");

fs.writeFileSync('src/pages/TravelTracker.jsx', content);
console.log('TravelTracker.jsx fixed');
