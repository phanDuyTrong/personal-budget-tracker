import React from 'react';
import { 
    HomeIcon, ShoppingCartIcon, TruckIcon, PaperAirplaneIcon, PuzzlePieceIcon,
    BeakerIcon, BookOpenIcon, BriefcaseIcon, GiftIcon, LightBulbIcon,
    DevicePhoneMobileIcon, MusicalNoteIcon, HeartIcon, FaceSmileIcon,
    SparklesIcon, BanknotesIcon, BuildingLibraryIcon, CreditCardIcon, ChartBarIcon, WrenchIcon,
    CubeIcon, QuestionMarkCircleIcon 
} from '@heroicons/react/24/outline';

const iconMap = {
    HomeIcon, ShoppingCartIcon, TruckIcon, PaperAirplaneIcon, PuzzlePieceIcon,
    BeakerIcon, BookOpenIcon, BriefcaseIcon, GiftIcon, LightBulbIcon,
    DevicePhoneMobileIcon, MusicalNoteIcon, HeartIcon, FaceSmileIcon,
    SparklesIcon, BanknotesIcon, BuildingLibraryIcon, CreditCardIcon, ChartBarIcon, WrenchIcon,
    CubeIcon, QuestionMarkCircleIcon
};

const emojiMap = {
    // Food & Dining
    '🍔': 'ShoppingCartIcon',
    '🍕': 'ShoppingCartIcon',
    '🍴': 'ShoppingCartIcon',
    '🍜': 'ShoppingCartIcon',
    
    // Shopping & Personal
    '👕': 'HeartIcon',
    '👗': 'HeartIcon',
    '🛒': 'ShoppingCartIcon',
    '🎁': 'GiftIcon',
    
    // Housing & Utilities
    '🏠': 'HomeIcon',
    '🏘️': 'HomeIcon',
    '💡': 'LightBulbIcon',
    '🚿': 'WrenchIcon',
    
    // Transport & Travel
    '🚗': 'TruckIcon',
    '🚌': 'TruckIcon',
    '✈️': 'PaperAirplaneIcon',
    '📦': 'PaperAirplaneIcon',
    
    // Financial & Income
    '💰': 'BanknotesIcon',
    '💵': 'BanknotesIcon',
    '🏦': 'BuildingLibraryIcon',
    '💳': 'CreditCardIcon',
    '📈': 'ChartBarIcon',
    
    // Health & Personal Care
    '🏋️': 'HeartIcon',
    '🏋': 'HeartIcon',
    '💊': 'HeartIcon',
    '🚑': 'HeartIcon',
    
    // Entertainment & Hobby
    '🎬': 'MusicalNoteIcon',
    '🎵': 'MusicalNoteIcon',
    '🎮': 'PuzzlePieceIcon',
    
    // Work & Education
    '👔': 'BriefcaseIcon',
    '💼': 'BriefcaseIcon',
    '🎓': 'BookOpenIcon',
    '📚': 'BookOpenIcon',
    
    // Others
    '❓': 'QuestionMarkCircleIcon',
    '🛠️': 'WrenchIcon',
    '✨': 'SparklesIcon',
};

export function DynamicIcon({ name, className = "h-5 w-5", ...props }) {
    if (!name) return <CubeIcon className={className} {...props} />;

    let mappedName = String(name);
    if (emojiMap[mappedName]) {
        mappedName = emojiMap[mappedName];
    } else if (!mappedName.endsWith('Icon')) {
        return (
            <span className={`inline-flex items-center justify-center ${className}`} {...props}>
                {mappedName}
            </span>
        );
    }

    const IconComponent = iconMap[mappedName] || QuestionMarkCircleIcon;
    return <IconComponent className={className} {...props} />;
}
