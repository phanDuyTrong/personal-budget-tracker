import React from 'react';
import { DatePicker as HeroDatePicker } from '@heroui/react';
import { parseDate } from '@internationalized/date';

export function DatePicker({ value, onChange, label, error, className = '' }) {
    // value could be 'YYYY-MM-DD' or a full ISO string. Extract just the date part.
    let dateValue = null;
    try {
        if (value) {
            const dateStr = value.split('T')[0];
            if (dateStr && dateStr.length === 10) {
                dateValue = parseDate(dateStr);
            }
        }
    } catch (e) {
        console.error("Invalid date value passed to DatePicker:", value, e);
    }

    const handleChange = (date) => {
        if (date) {
            // date is a CalendarDate object which has a toString() method returning 'YYYY-MM-DD'
            onChange(date.toString());
        } else {
            onChange(null);
        }
    };

    return (
        <HeroDatePicker
            label={label}
            value={dateValue}
            onChange={handleChange}
            errorMessage={error}
            isInvalid={!!error}
            className={className}
            variant="flat"
            labelPlacement="inside"
        />
    );
}
