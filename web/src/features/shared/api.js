export const useDevMockData = import.meta.env.VITE_DEV_MOCK_AUTH === 'true';

export function nowISO() {
    return new Date().toISOString();
}

export function buildTree(categories) {
    const map = {};
    categories.forEach(c => { map[c.id] = { ...c, children: [] }; });
    const roots = [];
    categories.forEach(c => {
        if (c.parent_id && map[c.parent_id]) map[c.parent_id].children.push(map[c.id]);
        else if (!c.parent_id) roots.push(map[c.id]);
    });
    return roots;
}
