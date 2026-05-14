import React, { useState } from 'react';
import { useStore } from '@/services/store';
import { Plus, X, Trash2, Edit2, Save } from 'lucide-react';
import { Label } from '@/components/ui/label';

export const CategoryManager = () => {
    const { categories, updateCategories } = useStore();
    const [editingId, setEditingId] = useState(null);
    const [newMainCategory, setNewMainCategory] = useState('');
    const [newSubCategory, setNewSubCategory] = useState('');
    const [editName, setEditName] = useState('');

    const handleAddMain = () => {
        if (!newMainCategory.trim()) return;
        const newCat = {
            id: 'c' + Date.now(),
            name: newMainCategory,
            subCategories: []
        };
        updateCategories([...categories, newCat]);
        setNewMainCategory('');
    };

    const handleDeleteMain = (id) => {
        if (confirm('Are you sure? This will delete all sub-categories too.')) {
            updateCategories(categories.filter(c => c.id !== id));
        }
    };

    const handleAddSub = (mainId) => {
        if (!newSubCategory.trim()) return;
        const updatedCats = categories.map(c => {
            if (c.id === mainId) {
                return { ...c, subCategories: [...c.subCategories, newSubCategory] };
            }
            return c;
        });
        updateCategories(updatedCats);
        setNewSubCategory('');
    };

    const handleDeleteSub = (mainId, subName) => {
        const updatedCats = categories.map(c => {
            if (c.id === mainId) {
                return { ...c, subCategories: c.subCategories.filter(s => s !== subName) };
            }
            return c;
        });
        updateCategories(updatedCats);
    };

    // Simple edit name logic for main category
    const startEdit = (cat) => {
        setEditingId(cat.id);
        setEditName(cat.name);
    }

    const saveEdit = () => {
        const updatedCats = categories.map(c => {
            if (c.id === editingId) {
                return { ...c, name: editName };
            }
            return c;
        });
        updateCategories(updatedCats);
        setEditingId(null);
    }

    return (
        <div className="space-y-6">
            <div className="flex gap-2">
                <input
                    type="text"
                    placeholder="New Main Category..."
                    className="flex-1 p-2 border rounded bg-background text-foreground"
                    value={newMainCategory}
                    onChange={(e) => setNewMainCategory(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddMain()}
                />
                <button onClick={handleAddMain} className="p-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">
                    <Plus className="h-5 w-5" />
                </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {categories.map(cat => (
                    <div key={cat.id} className="border p-4 rounded-lg space-y-3">
                        <div className="flex items-center justify-between font-bold border-b pb-2">
                            {editingId === cat.id ? (
                                <div className="flex gap-2">
                                    <input
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        className="p-1 border rounded"
                                    />
                                    <button onClick={saveEdit}><Save className="h-4 w-4" /></button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span>{cat.name}</span>
                                    <button onClick={() => startEdit(cat)} className="text-muted-foreground hover:text-foreground"><Edit2 className="h-3 w-3" /></button>
                                </div>
                            )}

                            <button onClick={() => handleDeleteMain(cat.id)} className="text-destructive hover:text-destructive/80">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {cat.subCategories.map(sub => (
                                <span key={sub} className="bg-muted px-2 py-1 rounded text-sm flex items-center gap-1">
                                    {sub}
                                    <button onClick={() => handleDeleteSub(cat.id, sub)} className="hover:text-destructive">
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            ))}
                        </div>

                        <div className="flex gap-2 pt-2">
                            <input
                                type="text"
                                placeholder="Add Sub-category..."
                                className="flex-1 p-1 text-sm border rounded bg-background"
                                value={editingId === cat.id + '_sub' ? newSubCategory : ''}
                                onChange={(e) => {
                                    setEditingId(cat.id + '_sub');
                                    setNewSubCategory(e.target.value);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleAddSub(cat.id);
                                        setEditingId(null);
                                    }
                                }}
                            />
                            <button onClick={() => {
                                if (editingId === cat.id + '_sub') handleAddSub(cat.id);
                            }} className="p-1 bg-secondary text-secondary-foreground rounded">
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
