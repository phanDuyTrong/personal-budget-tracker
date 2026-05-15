export const useDevMockData = import.meta.env.VITE_DEV_MOCK_AUTH === 'true';

export type TreeCategory = {
    id: string;
    parent_id?: string | null;
    children?: TreeCategory[];
    [key: string]: unknown;
};

export function nowISO() {
    return new Date().toISOString();
}

export function buildTree<T extends TreeCategory>(categories: T[]) {
    const map: Record<string, T & { children: Array<T & { children: unknown[] }> }> = {};
    categories.forEach(c => { map[c.id] = { ...c, children: [] }; });
    const roots: Array<T & { children: unknown[] }> = [];
    categories.forEach(c => {
        if (c.parent_id && map[c.parent_id]) map[c.parent_id].children.push(map[c.id]);
        else if (!c.parent_id) roots.push(map[c.id]);
    });
    return roots;
}
