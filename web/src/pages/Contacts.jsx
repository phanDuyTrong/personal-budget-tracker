import React, { useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, UsersIcon, EnvelopeIcon, PhoneIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useContacts, useContactMutations } from '@/hooks/useApi';
import { Modal, Button, Input, Field, Skeleton, EmptyState, ConfirmModal, useToast } from '@/components/ui';

function ContactModal({ open, onClose, contact }) {
    const isEdit = !!contact;
    const [form, setForm] = useState(isEdit
        ? { name: contact.name, email: contact.email || '', phone: contact.phone || '' }
        : { name: '', email: '', phone: '' }
    );
    const { create, update } = useContactMutations();
    const toast = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEdit) await update.mutateAsync({ id: contact.id, ...form });
            else await create.mutateAsync(form);
            toast(`Contact ${isEdit ? 'updated' : 'added'}!`, 'success');
            onClose();
        } catch (err) { toast(err.message || 'Error saving contact', 'error'); }
    };

    return (
        <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Contact' : 'New Contact'}>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <Field label="Full Name">
                    <Input placeholder="e.g. John Doe, Salary Company" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Email (optional)">
                        <Input type="email" placeholder="john@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                    </Field>
                    <Field label="Phone (optional)">
                        <Input type="tel" placeholder="+1 234 567 8900" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                    </Field>
                </div>
                <div className="flex gap-2 justify-end pt-4 border-t border-neutral-100 dark:border-neutral-800">
                    <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                    <Button type="submit" loading={create.isPending || update.isPending}>{isEdit ? 'Save Changes' : 'Add Contact'}</Button>
                </div>
            </form>
        </Modal>
    );
}

export function Contacts() {
    const [modal, setModal] = useState(null); // null | 'new' | contact object
    const [confirmDel, setConfirmDel] = useState(null);
    const [search, setSearch] = useState('');

    const { data: contacts = [], isLoading } = useContacts();
    const { remove } = useContactMutations();
    const toast = useToast();

    const handleDelete = async (contact) => {
        try {
            await remove.mutateAsync(contact.id);
            toast('Contact deleted', 'success');
        } catch { toast('Error deleting contact', 'error'); }
        setConfirmDel(null);
    };

    const filteredContacts = contacts.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
        (c.phone && c.phone.includes(search))
    );

    return (
        <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Contacts</h1>
                    <p className="text-sm mt-0.5 text-neutral-500">Manage people or entities associated with your transactions (For Who)</p>
                </div>
                <Button onClick={() => setModal('new')}><PlusIcon className="h-4 w-4" /> New Contact</Button>
            </div>

            {/* Search */}
            {contacts.length > 0 && (
                <div className="flex items-center gap-2 max-w-sm">
                    <MagnifyingGlassIcon className="h-4 w-4 flex-shrink-0 text-neutral-400" />
                    <Input placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
                </div>
            )}

            {/* Contact List */}
            {isLoading ? (
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
                </div>
            ) : contacts.length === 0 ? (
                <EmptyState icon={UsersIcon} title="No contacts yet"
                    description="Add people or companies to link them to your transactions."
                    action={<Button onClick={() => setModal('new')}><PlusIcon className="h-4 w-4" /> Add First Contact</Button>} />
            ) : filteredContacts.length === 0 ? (
                <div className="text-center py-10 text-neutral-500">No contacts match your search.</div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {filteredContacts.map(contact => (
                        <div key={contact.id} className="p-5 rounded-2xl relative group flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                            <div className="flex items-start justify-between gap-2 mb-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary dark:bg-primary/20">
                                    <span className="text-lg font-bold">{contact.name.charAt(0).toUpperCase()}</span>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                    <button onClick={() => setModal(contact)} className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white transition-colors"><PencilIcon className="h-3.5 w-3.5" /></button>
                                    <button onClick={() => setConfirmDel(contact)} className="p-1.5 rounded-lg text-neutral-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"><TrashIcon className="h-3.5 w-3.5" /></button>
                                </div>
                            </div>

                            <h3 className="font-semibold text-base mb-1 text-neutral-900 dark:text-white">{contact.name}</h3>

                            <div className="space-y-1.5 mt-auto pt-2 text-sm text-neutral-500">
                                {contact.email && (
                                    <div className="flex items-center gap-2 truncate" title={contact.email}>
                                        <EnvelopeIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-70" /> {contact.email}
                                    </div>
                                )}
                                {contact.phone && (
                                    <div className="flex items-center gap-2 truncate">
                                        <PhoneIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-70" /> {contact.phone}
                                    </div>
                                )}
                                {!contact.email && !contact.phone && (
                                    <div className="text-xs opacity-50 italic">No contact details</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modal && (
                <ContactModal open onClose={() => setModal(null)} contact={modal === 'new' ? null : modal} />
            )}
            <ConfirmModal
                open={!!confirmDel}
                title={`Delete "${confirmDel?.name}"?`}
                description="This contact will be removed. Any transactions linked to this contact will keep their records but will no longer be linked to this person."
                onConfirm={() => handleDelete(confirmDel)}
                onCancel={() => setConfirmDel(null)}
            />
        </div>
    );
}
