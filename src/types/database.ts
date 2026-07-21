export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { user_id: string; currency: string; created_at: string; updated_at: string }
        Insert: { user_id: string; currency?: string; created_at?: string; updated_at?: string }
        Update: { user_id?: string; currency?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
      categories: {
        Row: { id: string; user_id: string; name: string; type: 'income' | 'expense'; color: string; is_default: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; name: string; type: 'income' | 'expense'; color?: string; is_default?: boolean; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; name?: string; type?: 'income' | 'expense'; color?: string; is_default?: boolean; created_at?: string; updated_at?: string }
        Relationships: []
      }
      accounts: {
        Row: { id: string; user_id: string; name: string; kind: 'asset' | 'liability'; opening_balance_minor: number; color: string; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; name: string; kind: 'asset' | 'liability'; opening_balance_minor?: number; color?: string; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; name?: string; kind?: 'asset' | 'liability'; opening_balance_minor?: number; color?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
      transactions: {
        Row: { id: string; user_id: string; type: 'income' | 'expense' | 'transfer'; amount_minor: number; account_id: string; to_account_id: string | null; category_id: string | null; merchant: string; note: string; transaction_date: string; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; type: 'income' | 'expense' | 'transfer'; amount_minor: number; account_id: string; to_account_id?: string | null; category_id?: string | null; merchant?: string; note?: string; transaction_date: string; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; type?: 'income' | 'expense' | 'transfer'; amount_minor?: number; account_id?: string; to_account_id?: string | null; category_id?: string | null; merchant?: string; note?: string; transaction_date?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
      budgets: {
        Row: { id: string; user_id: string; category_id: string; month: string; limit_minor: number; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; category_id: string; month: string; limit_minor: number; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; category_id?: string; month?: string; limit_minor?: number; created_at?: string; updated_at?: string }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      account_kind: 'asset' | 'liability'
      category_type: 'income' | 'expense'
      transaction_type: 'income' | 'expense' | 'transfer'
    }
    CompositeTypes: Record<string, never>
  }
}
