import React, { useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, ChevronRightIcon, ChevronDownIcon, TagIcon } from '@heroicons/react/24/outline';
import { 
    Button, 
    Input as HeroInput, 
    Select as HeroSelect, 

    Skeleton,
    Tooltip,
    Chip,
    Accordion,
    AccordionItem,
    Modal as HeroModal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,

 SelectItem } from "@heroui/react";
import { useCategories, useCategoryMutations } from '@/features/categories/hooks';
import { Modal, Field, EmptyState, ConfirmModal, useToast, DynamicIcon , GlassCard } from '@/components/ui';

const ICONS = [
    'HomeIcon', 'ShoppingCartIcon', 'TruckIcon', 'PaperAirplaneIcon', 'PuzzlePieceIcon', 
    'BeakerIcon', 'BookOpenIcon', 'BriefcaseIcon', 'GiftIcon', 'LightBulbIcon', 
    'DevicePhoneMobileIcon', 'MusicalNoteIcon', 'HeartIcon', 'FaceSmileIcon', 
    'SparklesIcon', 'BanknotesIcon', 'BuildingLibraryIcon', 'CreditCardIcon', 'ChartBarIcon', 'WrenchIcon'
];
const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#a855f7', '#64748b', '#0ea5e9'];

function CategoryModal({ open, onClose, category, parentCategory }) {
    const isEdit = !!category;
    const [form, setForm] = useState(isEdit ? { name: category.name, icon: category.icon || '', color: category.color || COLORS[5], type: category.type, parentId: category.parent_id || '' } : { name: '', icon: '', color: COLORS[5], type: parentCategory?.type || 'expense', parentId: parentCategory?.id || '' });
    const { create, update } = useCategoryMutations();
    const { data: categoryTree = [] } = useCategories();
    const toast = useToast();

    const roots = categoryTree;

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...form, parentId: form.parentId || null };
            if (isEdit) await update.mutateAsync({ id: category.id, ...payload });
            else await create.mutateAsync(payload);
            toast(`Category ${isEdit ? 'updated' : 'created'}!`, 'success');
            onClose();
        } catch (err) { toast(err.response?.data?.error?.message || 'Error', 'error'); }
    };

    return (
        <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Category' : parentCategory ? `New Sub-category under "${parentCategory.name}"` : 'New Category'}>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <HeroInput 
                    label="Name"
                    placeholder="Category name" 
                    value={form.name} 
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
                    required 
                    variant="flat"
                />
                
                <HeroSelect 
                    label="Type"
                    selectedKeys={[form.type]} 
                    onSelectionChange={keys => setForm(f => ({ ...f, type: Array.from(keys)[0] }))}
                    variant="flat"
                    isDisabled={!!parentCategory}
                >
                    <SelectItem key="expense" textValue="Expense">Expense</SelectItem>
                    <SelectItem key="income" textValue="Income">Income</SelectItem>
                </HeroSelect>

                {!parentCategory && !isEdit && (
                    <HeroSelect 
                        label="Parent Category (Optional)"
                        placeholder="None (top-level)"
                        selectedKeys={form.parentId ? [form.parentId] : []}
                        onSelectionChange={keys => setForm(f => ({ ...f, parentId: Array.from(keys)[0] }))}
                        variant="flat"
                    >
                        {roots.map(c => <SelectItem key={c.id} textValue={c.name}>{c.name}</SelectItem>)}
                    </HeroSelect>
                )}

                <div className="space-y-2">
                    <p className="text-sm font-medium text-neutral-500">Icon</p>
                    <div className="flex flex-wrap gap-2">
                        {ICONS.map(icon => (
                            <button key={icon} type="button" onClick={() => setForm(f => ({ ...f, icon }))} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${form.icon === icon ? 'bg-primary text-white scale-110 shadow-lg' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}>
                                <DynamicIcon name={icon} className="h-6 w-6" />
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-sm font-medium text-neutral-500">Color</p>
                    <div className="flex flex-wrap gap-2">
                        {COLORS.map(color => (
                            <button key={color} type="button" onClick={() => setForm(f => ({ ...f, color }))} className="w-8 h-8 rounded-full transition-all hover:scale-110" style={{ background: color, border: form.color === color ? '3px solid white' : 'none', boxShadow: form.color === color ? '0 0 0 2px ' + color : 'none' }} />
                        ))}
                    </div>
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t border-neutral-100 dark:border-neutral-800">
                    <Button variant="light" onClick={onClose}>Cancel</Button>
                    <Button color="primary" type="submit" className="font-bold">{isEdit ? 'Save' : 'Create'}</Button>
                </div>
            </form>
        </Modal>
    );
}

function ReassignModal({ open, onClose, category, onReassign }) {
    const { data: categoryTree = [] } = useCategories();
    const [newId, setNewId] = useState('none');
    const flatCats = categoryTree.flatMap(c => [c, ...(c.children || [])]).filter(c => c.id !== category?.id);
    
    return (
        <Modal open={open} onClose={onClose} title="Reassign Transactions" size="sm">
            <div className="p-6 space-y-6">
                <p className="text-sm text-neutral-500">"{category?.name}" has linked transactions. Select a new category before deleting:</p>
                <HeroSelect 
                    label="Reassign to"
                    selectedKeys={[newId]}
                    onSelectionChange={keys => setNewId(Array.from(keys)[0])}
                    variant="flat"
                >
                    <SelectItem key="none" textValue="Set to Uncategorized">Set to Uncategorized</SelectItem>
                    {flatCats.map(c => <SelectItem key={c.id} textValue={c.name}>{c.name}</SelectItem>)}
                </HeroSelect>
                <div className="flex gap-2 justify-end pt-4">
                    <Button variant="light" onClick={onClose}>Cancel</Button>
                    <Button color="danger" onClick={() => onReassign(newId === 'none' ? '' : newId)} className="font-bold">Reassign & Delete</Button>
                </div>
            </div>
        </Modal>
    );
}

export function Categories() {
    const [filter, setFilter] = useState('all');
    const [modal, setModal] = useState(null); // null | 'new' | { category, parentCategory? }
    const [confirmDel, setConfirmDel] = useState(null);
    const [reassignModal, setReassignModal] = useState(null);
    const toast = useToast();

    const { data: categoryTree = [], isLoading } = useCategories();
    const { remove, reassign } = useCategoryMutations();

    const filtered = categoryTree.filter(c => filter === 'all' || c.type === filter);

    const handleDeleteAttempt = async (cat) => {
        try {
            await remove.mutateAsync(cat.id);
            toast('Deleted', 'success');
        } catch (err) {
            const code = err.response?.data?.error?.code;
            if (code === 'LINKED_TRANSACTIONS' || code === 'LINKED_SPLITS') { setReassignModal(cat); }
            else { toast(err.response?.data?.error?.message || 'Error', 'error'); }
        }
        setConfirmDel(null);
    };

    const handleReassign = async (newCategoryId) => {
        try {
            await reassign.mutateAsync({ id: reassignModal.id, newCategoryId: newCategoryId || null });
            await remove.mutateAsync(reassignModal.id);
            toast('Category deleted', 'success');
        } catch { toast('Error', 'error'); }
        setReassignModal(null);
    };

    return (
        <div className="p-4 md:p-8 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-neutral-900 dark:text-white">Categories</h1>
                    <p className="text-neutral-500">Organize your income and expenses</p>
                </div>
                <div className="flex gap-2">
                    <HeroSelect 
                        className="w-32"
                        selectedKeys={[filter]} 
                        onSelectionChange={keys => setFilter(Array.from(keys)[0])}
                        variant="flat"
                    >
                        <SelectItem key="all" textValue="All">All</SelectItem>
                        <SelectItem key="expense" textValue="Expense">Expense</SelectItem>
                        <SelectItem key="income" textValue="Income">Income</SelectItem>
                    </HeroSelect>
                    <Button color="primary" startContent={<PlusIcon className="h-4 w-4" />} onClick={() => setModal({ category: null, parentCategory: null })} className="font-bold">
                        Add Category
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="space-y-4">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-3xl" />)}</div>
            ) : filtered.length === 0 ? (
                <EmptyState icon={TagIcon} title="No categories" description="Add categories to organize your transactions." action={<Button color="primary" onClick={() => setModal({ category: null, parentCategory: null })} startContent={<PlusIcon className="h-4 w-4" />}>Add Category</Button>} />
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {filtered.map(cat => (
                        <GlassCard key={cat.id} className="p-0">
                            <div className="flex items-center gap-4 px-6 py-4 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 transition-colors group">
                                <div 
                                    className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" 
                                    style={{ 
                                        backgroundColor: cat.color ? `${cat.color}20` : 'rgba(255, 87, 34, 0.1)', 
                                        color: cat.color || '#FF5722' 
                                    }}
                                >
                                    <DynamicIcon name={cat.icon} className="h-6 w-6" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-black text-neutral-900 dark:text-white tracking-tight">{cat.name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Chip size="xs" variant="flat" color={cat.type === 'income' ? 'success' : 'danger'} className="h-4 text-[9px] font-black uppercase">
                                            {cat.type}
                                        </Chip>
                                        <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                                            {(cat.children || []).length} Sub-categories
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Tooltip content="Add Sub-category">
                                        <Button isIconOnly size="sm" variant="light" color="primary" onClick={() => setModal({ category: null, parentCategory: cat })}>
                                            <PlusIcon className="h-4 w-4" />
                                        </Button>
                                    </Tooltip>
                                    <Tooltip content="Edit">
                                        <Button isIconOnly size="sm" variant="light" onClick={() => setModal({ category: cat, parentCategory: null })}>
                                            <PencilIcon className="h-4 w-4 text-neutral-400" />
                                        </Button>
                                    </Tooltip>
                                    <Tooltip content="Delete" color="danger">
                                        <Button isIconOnly size="sm" variant="light" color="danger" onClick={() => setConfirmDel(cat)}>
                                            <TrashIcon className="h-4 w-4 text-neutral-400 hover:text-danger" />
                                        </Button>
                                    </Tooltip>
                                </div>
                            </div>
                            
                            {/* Children */}
                            {(cat.children || []).length > 0 && (
                                <div className="px-6 pb-6 pt-2">
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                        {cat.children.map(sub => (
                                            <div key={sub.id} className="relative group/sub flex flex-col items-center justify-center p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-all text-center">
                                                <div 
                                                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 shadow-sm" 
                                                    style={{ backgroundColor: sub.color ? `${sub.color}20` : 'rgba(255, 87, 34, 0.1)', color: sub.color || '#FF5722' }}
                                                >
                                                    <DynamicIcon name={sub.icon} className="h-5 w-5" />
                                                </div>
                                                <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 truncate w-full">{sub.name}</span>
                                                
                                                <div className="absolute top-1 right-1 flex flex-col opacity-0 group-hover/sub:opacity-100 transition-opacity">
                                                    <Button isIconOnly size="xs" variant="light" onClick={() => setModal({ category: sub, parentCategory: null })}>
                                                        <PencilIcon className="h-3 w-3 text-neutral-400" />
                                                    </Button>
                                                    <Button isIconOnly size="xs" variant="light" color="danger" onClick={() => setConfirmDel(sub)}>
                                                        <TrashIcon className="h-3 w-3 text-neutral-400 hover:text-danger" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                        <button 
                                            onClick={() => setModal({ category: null, parentCategory: cat })}
                                            className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-neutral-200 dark:border-neutral-800 hover:border-primary/50 hover:bg-primary/5 transition-all group/add text-neutral-400 hover:text-primary"
                                        >
                                            <PlusIcon className="w-6 h-6 mb-1" />
                                            <span className="text-[10px] font-black uppercase tracking-wider">Add Sub</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </GlassCard>
                    ))}
                </div>
            )}

            {modal !== null && <CategoryModal open onClose={() => setModal(null)} category={modal.category} parentCategory={modal.parentCategory} />}
            <ConfirmModal open={!!confirmDel} title={`Delete "${confirmDel?.name}"?`} description="If transactions use this category, you'll be prompted to reassign them." onConfirm={() => handleDeleteAttempt(confirmDel)} onCancel={() => setConfirmDel(null)} />
            {reassignModal && <ReassignModal open category={reassignModal} onClose={() => setReassignModal(null)} onReassign={handleReassign} />}
        </div>
    );
}
