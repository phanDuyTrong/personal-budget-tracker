import re

with open("src/pages/Transactions.jsx", "r") as f:
    content = f.read()

# 1. Imports
content = content.replace(
    'Select, \n \n    Button',
    'Select, \n    Autocomplete, AutocompleteItem,\n    Button'
)
content = content.replace(
    "import { useSettingsStore } from '@/stores/settingsStore';",
    "import { useSettingsStore } from '@/stores/settingsStore';\nimport { viFilter } from '@/lib/filters';"
)

# 2. Wallet Modal
wallet_target = """                    <Field label="Wallet">
                        <Select 
                            placeholder="Select wallet"
                            selectedKeys={form.walletId ? [form.walletId] : []}
                            onSelectionChange={(keys) => handleFormChange('walletId', Array.from(keys)[0])}
                            variant="flat"
                            required
                        >
                            {wallets.map(a => <SelectItem key={a.id} textValue={a.name}>{a.name}</SelectItem>)}
                        </Select>
                    </Field>"""
wallet_repl = """                    <Field label="Wallet">
                        <Autocomplete 
                            placeholder="Search wallet..."
                            defaultFilter={viFilter}
                            selectedKey={form.walletId || null}
                            onSelectionChange={(key) => handleFormChange('walletId', key || '')}
                            variant="flat"
                            isRequired
                        >
                            {wallets.map(a => <AutocompleteItem key={a.id} textValue={a.name}>{a.name}</AutocompleteItem>)}
                        </Autocomplete>
                    </Field>"""
content = content.replace(wallet_target, wallet_repl)

# 3. To Wallet Modal
towallet_target = """                    <Field label="To Wallet">
                        <Select 
                            placeholder="Select destination"
                            selectedKeys={form.toWalletId ? [form.toWalletId] : []}
                            onSelectionChange={(keys) => handleFormChange('toWalletId', Array.from(keys)[0])}
                            variant="flat"
                            required
                        >
                            {wallets.filter(a => a.id !== form.walletId).map(a => <SelectItem key={a.id} textValue={a.name}>{a.name}</SelectItem>)}
                        </Select>
                    </Field>"""
towallet_repl = """                    <Field label="To Wallet">
                        <Autocomplete 
                            placeholder="Search destination..."
                            defaultFilter={viFilter}
                            selectedKey={form.toWalletId || null}
                            onSelectionChange={(key) => handleFormChange('toWalletId', key || '')}
                            variant="flat"
                            isRequired
                        >
                            {wallets.filter(a => a.id !== form.walletId).map(a => <AutocompleteItem key={a.id} textValue={a.name}>{a.name}</AutocompleteItem>)}
                        </Autocomplete>
                    </Field>"""
content = content.replace(towallet_target, towallet_repl)

# 4. Category Modal
cat_target = """                <Field label="Category">
                    <Select 
                        placeholder="No category"
                        selectedKeys={form.categoryId ? [form.categoryId] : []}
                        onSelectionChange={(keys) => handleFormChange('categoryId', Array.from(keys)[0])}
                        variant="flat"
                    >
                        {flatCats.map(cat => (
                            <SelectItem key={cat.id} textValue={cat.name}>
                                {cat.label}
                            </SelectItem>
                        ))}
                    </Select>
                </Field>"""
cat_repl = """                <Field label="Category">
                    <Autocomplete 
                        placeholder="Search category..."
                        defaultFilter={viFilter}
                        selectedKey={form.categoryId || null}
                        onSelectionChange={(key) => handleFormChange('categoryId', key || '')}
                        variant="flat"
                    >
                        {flatCats.map(cat => (
                            <AutocompleteItem key={cat.id} textValue={cat.name}>
                                {cat.label}
                            </AutocompleteItem>
                        ))}
                    </Autocomplete>
                </Field>"""
content = content.replace(cat_target, cat_repl)

# 5. Contact Modal
contact_target = """                <Field label="For Who (Contact)">
                    <Select 
                        placeholder="No one"
                        selectedKeys={form.contactId ? [form.contactId] : []}
                        onSelectionChange={(keys) => handleFormChange('contactId', Array.from(keys)[0])}
                        variant="flat"
                    >
                        {contacts.map(c => <SelectItem key={c.id} textValue={c.name}>{c.name}</SelectItem>)}
                    </Select>"""
contact_repl = """                <Field label="For Who (Contact)">
                    <Autocomplete 
                        placeholder="Search contact..."
                        defaultFilter={viFilter}
                        selectedKey={form.contactId || null}
                        onSelectionChange={(key) => handleFormChange('contactId', key || '')}
                        variant="flat"
                    >
                        {contacts.map(c => <AutocompleteItem key={c.id} textValue={c.name}>{c.name}</AutocompleteItem>)}
                    </Autocomplete>"""
content = content.replace(contact_target, contact_repl)

# 6. Split Category
split_target = """                                <Select 
                                    className="flex-1" 
                                    placeholder="Category"
                                    selectedKeys={s.categoryId ? [s.categoryId] : []}
                                    onSelectionChange={keys => {
                                        const n = [...splits];
                                        n[i].categoryId = Array.from(keys)[0];
                                        setSplits(n);
                                    }}
                                    variant="flat"
                                    size="sm"
                                >
                                    {flatCats.map(c => <SelectItem key={c.id} textValue={c.name}>{c.label}</SelectItem>)}
                                </Select>"""
split_repl = """                                <Autocomplete 
                                    className="flex-1" 
                                    placeholder="Search category..."
                                    defaultFilter={viFilter}
                                    selectedKey={s.categoryId || null}
                                    onSelectionChange={key => {
                                        const n = [...splits];
                                        n[i].categoryId = key || '';
                                        setSplits(n);
                                    }}
                                    variant="flat"
                                    size="sm"
                                >
                                    {flatCats.map(c => <AutocompleteItem key={c.id} textValue={c.name}>{c.label}</AutocompleteItem>)}
                                </Autocomplete>"""
content = content.replace(split_target, split_repl)

# 7. Filters section
filters_target = """                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Select 
                        placeholder="All Wallets"
                        selectedKeys={[filters.walletId]}
                        onSelectionChange={keys => updateFilter('walletId', Array.from(keys)[0])}
                        variant="flat"
                    >
                        <SelectItem key="all">All Wallets</SelectItem>
                        {wallets.map(w => <SelectItem key={w.id} textValue={w.name}>{w.name}</SelectItem>)}
                    </Select>
                    <Select 
                        placeholder="All Categories"
                        selectedKeys={[filters.categoryId]}
                        onSelectionChange={keys => updateFilter('categoryId', Array.from(keys)[0])}
                        variant="flat"
                    >
                        <SelectItem key="all">All Categories</SelectItem>
                        {flatCats.map(cat => <SelectItem key={cat.id} textValue={cat.name}>{cat.label}</SelectItem>)}
                    </Select>
                    <Select 
                        placeholder="All Contacts"
                        selectedKeys={[filters.contactId]}
                        onSelectionChange={keys => updateFilter('contactId', Array.from(keys)[0])}
                        variant="flat"
                    >
                        <SelectItem key="all">All Contacts</SelectItem>
                        {contacts.map(c => <SelectItem key={c.id} textValue={c.name}>{c.name}</SelectItem>)}
                    </Select>
                </div>"""
filters_repl = """                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Autocomplete 
                        placeholder="Search Wallets..."
                        defaultFilter={viFilter}
                        selectedKey={filters.walletId === 'all' ? null : filters.walletId}
                        onSelectionChange={key => updateFilter('walletId', key || 'all')}
                        variant="flat"
                    >
                        <AutocompleteItem key="all" textValue="All Wallets">All Wallets</AutocompleteItem>
                        {wallets.map(w => <AutocompleteItem key={w.id} textValue={w.name}>{w.name}</AutocompleteItem>)}
                    </Autocomplete>
                    <Autocomplete 
                        placeholder="Search Categories..."
                        defaultFilter={viFilter}
                        selectedKey={filters.categoryId === 'all' ? null : filters.categoryId}
                        onSelectionChange={key => updateFilter('categoryId', key || 'all')}
                        variant="flat"
                    >
                        <AutocompleteItem key="all" textValue="All Categories">All Categories</AutocompleteItem>
                        {flatCats.map(cat => <AutocompleteItem key={cat.id} textValue={cat.name}>{cat.label}</AutocompleteItem>)}
                    </Autocomplete>
                    <Autocomplete 
                        placeholder="Search Contacts..."
                        defaultFilter={viFilter}
                        selectedKey={filters.contactId === 'all' ? null : filters.contactId}
                        onSelectionChange={key => updateFilter('contactId', key || 'all')}
                        variant="flat"
                    >
                        <AutocompleteItem key="all" textValue="All Contacts">All Contacts</AutocompleteItem>
                        {contacts.map(c => <AutocompleteItem key={c.id} textValue={c.name}>{c.name}</AutocompleteItem>)}
                    </Autocomplete>
                </div>"""
content = content.replace(filters_target, filters_repl)

with open("src/pages/Transactions.jsx", "w") as f:
    f.write(content)
