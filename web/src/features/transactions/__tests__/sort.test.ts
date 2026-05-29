import { describe, expect, it } from "vitest";

import {
    sortTransactionsForDisplay,
    TRANSACTION_SORT_MODES,
} from "@/features/transactions/sort";

const rows = [
    {
        id: "tx-1",
        date: "2026-05-10",
        created_at: "2026-05-10T08:00:00.000Z",
        updated_at: "2026-05-10T08:00:00.000Z",
    },
    {
        id: "tx-2",
        date: "2026-05-12",
        created_at: "2026-05-12T08:00:00.000Z",
        updated_at: "2026-05-13T10:00:00.000Z",
    },
    {
        id: "tx-3",
        date: "2026-05-08",
        created_at: "2026-05-08T08:00:00.000Z",
        updated_at: "2026-05-14T10:00:00.000Z",
    },
];

describe("sortTransactionsForDisplay", () => {
    it("sorts by newest transaction date by default", () => {
        expect(sortTransactionsForDisplay(rows).map((row) => row.id)).toEqual([
            "tx-2",
            "tx-1",
            "tx-3",
        ]);
    });

    it("sorts by oldest transaction date", () => {
        expect(
            sortTransactionsForDisplay(rows, TRANSACTION_SORT_MODES.OLDEST).map(
                (row) => row.id,
            ),
        ).toEqual(["tx-3", "tx-1", "tx-2"]);
    });

    it("sorts by most recently updated", () => {
        expect(
            sortTransactionsForDisplay(
                rows,
                TRANSACTION_SORT_MODES.UPDATED_NEWEST,
            ).map((row) => row.id),
        ).toEqual(["tx-3", "tx-2", "tx-1"]);
    });

    it("sorts by least recently updated", () => {
        expect(
            sortTransactionsForDisplay(
                rows,
                TRANSACTION_SORT_MODES.UPDATED_OLDEST,
            ).map((row) => row.id),
        ).toEqual(["tx-1", "tx-2", "tx-3"]);
    });
});
