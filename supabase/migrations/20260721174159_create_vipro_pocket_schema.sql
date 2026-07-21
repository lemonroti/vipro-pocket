create extension if not exists pgcrypto;

create type public.account_kind as enum ('asset', 'liability');
create type public.transaction_type as enum ('income', 'expense', 'transfer');
create type public.category_type as enum ('income', 'expense');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  currency text not null default 'MYR' check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 50),
  type public.category_type not null,
  color text not null default '#78827a' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index categories_user_name_type_unique
  on public.categories (user_id, lower(name), type);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  kind public.account_kind not null,
  opening_balance_minor bigint not null default 0,
  color text not null default '#2aa883' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index accounts_user_created_idx on public.accounts (user_id, created_at);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.transaction_type not null,
  amount_minor bigint not null check (amount_minor > 0),
  account_id uuid not null,
  to_account_id uuid,
  category_id uuid,
  merchant text not null default '' check (char_length(merchant) <= 120),
  note text not null default '' check (char_length(note) <= 500),
  transaction_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_account_owner_fk foreign key (account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  constraint transactions_to_account_owner_fk foreign key (to_account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  constraint transactions_category_owner_fk foreign key (category_id, user_id) references public.categories (id, user_id) on delete restrict,
  constraint transactions_shape_check check (
    (type = 'transfer' and to_account_id is not null and category_id is null and account_id <> to_account_id)
    or
    (type in ('income', 'expense') and to_account_id is null and category_id is not null)
  )
);

create index transactions_user_date_idx on public.transactions (user_id, transaction_date desc, created_at desc);
create index transactions_account_idx on public.transactions (user_id, account_id);
create index transactions_to_account_idx on public.transactions (user_id, to_account_id);
create index transactions_category_idx on public.transactions (user_id, category_id);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null,
  month date not null check (extract(day from month) = 1),
  limit_minor bigint not null check (limit_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_category_owner_fk foreign key (category_id, user_id) references public.categories (id, user_id) on delete restrict,
  unique (user_id, category_id, month)
);

create index budgets_user_month_idx on public.budgets (user_id, month);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger accounts_set_updated_at before update on public.accounts for each row execute function public.set_updated_at();
create trigger transactions_set_updated_at before update on public.transactions for each row execute function public.set_updated_at();
create trigger budgets_set_updated_at before update on public.budgets for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, currency) values (new.id, 'MYR');

  insert into public.categories (user_id, name, type, color, is_default)
  values
    (new.id, 'Food', 'expense', '#ef7b66', true),
    (new.id, 'Transport', 'expense', '#4f8cff', true),
    (new.id, 'Shopping', 'expense', '#8d7cf7', true),
    (new.id, 'Bills', 'expense', '#d39b28', true),
    (new.id, 'Entertainment', 'expense', '#df66a5', true),
    (new.id, 'Health', 'expense', '#2aa883', true),
    (new.id, 'Education', 'expense', '#5776d9', true),
    (new.id, 'Others', 'expense', '#78827a', true),
    (new.id, 'Salary', 'income', '#2aa883', true),
    (new.id, 'Freelance', 'income', '#4f8cff', true),
    (new.id, 'Other income', 'income', '#78827a', true);

  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy categories_select_own on public.categories for select to authenticated using ((select auth.uid()) = user_id);
create policy categories_insert_own on public.categories for insert to authenticated with check ((select auth.uid()) = user_id);
create policy categories_update_own on public.categories for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy categories_delete_own on public.categories for delete to authenticated using ((select auth.uid()) = user_id);

create policy accounts_select_own on public.accounts for select to authenticated using ((select auth.uid()) = user_id);
create policy accounts_insert_own on public.accounts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy accounts_update_own on public.accounts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy accounts_delete_own on public.accounts for delete to authenticated using ((select auth.uid()) = user_id);

create policy transactions_select_own on public.transactions for select to authenticated using ((select auth.uid()) = user_id);
create policy transactions_insert_own on public.transactions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy transactions_update_own on public.transactions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy transactions_delete_own on public.transactions for delete to authenticated using ((select auth.uid()) = user_id);

create policy budgets_select_own on public.budgets for select to authenticated using ((select auth.uid()) = user_id);
create policy budgets_insert_own on public.budgets for insert to authenticated with check ((select auth.uid()) = user_id);
create policy budgets_update_own on public.budgets for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy budgets_delete_own on public.budgets for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.profiles, public.categories, public.accounts, public.transactions, public.budgets from anon;
grant select, insert, update, delete on public.profiles, public.categories, public.accounts, public.transactions, public.budgets to authenticated;
