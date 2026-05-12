import React, { useState } from 'react';
import { useStore } from '@/services/store';
import { Plus, Trash2, User } from 'lucide-react';

export const PersonManager = () => {
    const { people, updatePeople } = useStore();
    const [newName, setNewName] = useState('');

    const handleAdd = () => {
        if (!newName.trim() || people.includes(newName)) return;
        updatePeople([...people, newName]);
        setNewName('');
    };

    const handleDelete = (name) => {
        updatePeople(people.filter(p => p !== name));
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <input
                    placeholder="Add Person..."
                    className="flex-1 p-2 border border-input rounded bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
                <button onClick={handleAdd} className="p-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors">
                    <Plus className="h-5 w-5" />
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {people.map(person => (
                    <div key={person} className="flex items-center justify-between p-2 border border-border rounded bg-card text-card-foreground hover:bg-accent/50 transition-colors">
                        <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-foreground">{person}</span>
                        </div>
                        <button onClick={() => handleDelete(person)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
