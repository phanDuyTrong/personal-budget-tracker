sed -i '' '/const GlassCard = ({ children, className = "" }) => (/,/);/d' "src/pages/TravelTracker.jsx"
sed -i '' 's/import {/import { GlassCard,/g' "src/pages/TravelTracker.jsx"
