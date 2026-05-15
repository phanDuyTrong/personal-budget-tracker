export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export type Wallet = {
    id: string;
    user_id: string;
    name: string;
    type: string;
    balance: number | null;
    currency: string | null;
    deleted_at: string | null;
    created_at: string | null;
    updated_at: string | null;
};

export type Category = {
    id: string;
    user_id: string;
    name: string;
    icon: string | null;
    color: string | null;
    type: string;
    parent_id: string | null;
    created_at: string | null;
    updated_at: string | null;
};

export type Contact = {
    id: string;
    user_id: string;
    name: string;
    email: string | null;
    phone: string | null;
    created_at: string | null;
    updated_at: string | null;
};

export type Trip = {
    id: string;
    user_id: string;
    name: string;
    destination: string | null;
    start_date: string;
    end_date: string;
    created_at: string | null;
    updated_at: string | null;
};

export type Transaction = {
    id: string;
    user_id: string;
    wallet_id: string | null;
    to_wallet_id: string | null;
    category_id: string | null;
    contact_id: string | null;
    trip_id: string | null;
    amount: number;
    type: string;
    description: string | null;
    date: string;
    recurrence_rule: string | null;
    is_recurring: boolean | null;
    is_reviewed: boolean | null;
    is_debt: boolean | null;
    created_at: string | null;
    updated_at: string | null;
};

export type TransactionSplit = {
    id: string;
    transaction_id: string;
    category_id: string | null;
    amount: number;
    note: string | null;
    created_at: string | null;
};

export type Budget = {
    id: string;
    user_id: string;
    category_id: string;
    amount: number;
    period: string;
    rollover: boolean | null;
    start_date: string;
    created_at: string | null;
    updated_at: string | null;
};

export type Goal = {
    id: string;
    user_id: string;
    wallet_id: string | null;
    name: string;
    target_amount: number;
    current_amount: number | null;
    deadline: string | null;
    status: string | null;
    created_at: string | null;
    updated_at: string | null;
};

export type AppData = {
    id: string;
    user_id: string | null;
    key: string;
    value: Json;
    created_at: string;
    updated_at: string;
};

type TableDefinition<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
    Row: Row;
    Insert: Insert;
    Update: Update;
    Relationships: [];
};

export type Database = {
    __InternalSupabase: {
        PostgrestVersion: '14.1';
    };
    public: {
        Tables: {
            wallets: TableDefinition<Wallet, Omit<Wallet, 'id' | 'created_at' | 'updated_at' | 'deleted_at'> & Partial<Pick<Wallet, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'balance' | 'currency'>>, Partial<Wallet>>;
            categories: TableDefinition<Category, Omit<Category, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<Category, 'id' | 'created_at' | 'updated_at' | 'icon' | 'color' | 'parent_id'>>, Partial<Category>>;
            contacts: TableDefinition<Contact, Omit<Contact, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<Contact, 'id' | 'created_at' | 'updated_at' | 'email' | 'phone'>>, Partial<Contact>>;
            trips: TableDefinition<Trip, Omit<Trip, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<Trip, 'id' | 'created_at' | 'updated_at' | 'destination'>>, Partial<Trip>>;
            transactions: TableDefinition<Transaction, Omit<Transaction, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<Transaction, 'id' | 'created_at' | 'updated_at' | 'wallet_id' | 'to_wallet_id' | 'category_id' | 'contact_id' | 'trip_id' | 'description' | 'recurrence_rule' | 'is_recurring' | 'is_reviewed' | 'is_debt'>>, Partial<Transaction>>;
            transaction_splits: TableDefinition<TransactionSplit, Omit<TransactionSplit, 'id' | 'created_at'> & Partial<Pick<TransactionSplit, 'id' | 'created_at' | 'category_id' | 'note'>>, Partial<TransactionSplit>>;
            budgets: TableDefinition<Budget, Omit<Budget, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<Budget, 'id' | 'created_at' | 'updated_at' | 'rollover'>>, Partial<Budget>>;
            goals: TableDefinition<Goal, Omit<Goal, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<Goal, 'id' | 'created_at' | 'updated_at' | 'wallet_id' | 'deadline' | 'current_amount' | 'status'>>, Partial<Goal>>;
            app_data: TableDefinition<AppData, Omit<AppData, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<AppData, 'id' | 'created_at' | 'updated_at' | 'user_id'>>, Partial<AppData>>;
        };
        Views: Record<string, never>;
        Functions: Record<string, never>;
        Enums: Record<string, never>;
        CompositeTypes: Record<string, never>;
    };
};

export type TableName = keyof Database['public']['Tables'];
export type Tables<T extends TableName> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends TableName> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends TableName> = Database['public']['Tables'][T]['Update'];
