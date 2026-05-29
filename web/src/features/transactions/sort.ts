export const TRANSACTION_SORT_MODES = {
    NEWEST: 'newest',
    OLDEST: 'oldest',
    UPDATED_NEWEST: 'updatedNewest',
    UPDATED_OLDEST: 'updatedOldest',
} as const;

const getSortTimestamp = (value?: string | null) => {
    if (!value) return Number.NaN;
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? Number.NaN : timestamp;
};

export const sortTransactionsForDisplay = <T extends {
    date?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
}>(rows: T[], sortMode: string = TRANSACTION_SORT_MODES.NEWEST) => {
    const sortedRows = [...rows];

    sortedRows.sort((a, b) => {
        const dateDiff = getSortTimestamp(a.date) - getSortTimestamp(b.date);
        const createdDiff = getSortTimestamp(a.created_at) - getSortTimestamp(b.created_at);
        const updatedDiff =
            getSortTimestamp(a.updated_at || a.created_at || a.date) -
            getSortTimestamp(b.updated_at || b.created_at || b.date);

        switch (sortMode) {
            case TRANSACTION_SORT_MODES.OLDEST:
                if (dateDiff !== 0) return dateDiff;
                return createdDiff;
            case TRANSACTION_SORT_MODES.UPDATED_NEWEST:
                if (updatedDiff !== 0) return -updatedDiff;
                if (dateDiff !== 0) return -dateDiff;
                return -createdDiff;
            case TRANSACTION_SORT_MODES.UPDATED_OLDEST:
                if (updatedDiff !== 0) return updatedDiff;
                if (dateDiff !== 0) return dateDiff;
                return createdDiff;
            case TRANSACTION_SORT_MODES.NEWEST:
            default:
                if (dateDiff !== 0) return -dateDiff;
                return -createdDiff;
        }
    });

    return sortedRows;
};
