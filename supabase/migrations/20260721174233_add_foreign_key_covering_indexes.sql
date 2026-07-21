create index budgets_category_owner_idx on public.budgets (category_id, user_id);
create index transactions_account_owner_idx on public.transactions (account_id, user_id);
create index transactions_to_account_owner_idx on public.transactions (to_account_id, user_id);
create index transactions_category_owner_idx on public.transactions (category_id, user_id);
