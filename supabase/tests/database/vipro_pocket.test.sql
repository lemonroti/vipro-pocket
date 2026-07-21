begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(40);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'categories', 'categories table exists');
select has_table('public', 'accounts', 'accounts table exists');
select has_table('public', 'transactions', 'transactions table exists');
select has_table('public', 'budgets', 'budgets table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.categories'::regclass),
  'categories has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.accounts'::regclass),
  'accounts has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.transactions'::regclass),
  'transactions has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.budgets'::regclass),
  'budgets has RLS enabled'
);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000001', 'pocket-user-1@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'pocket-user-2@example.test');

select is(
  (select count(*) from public.profiles where user_id = '00000000-0000-0000-0000-000000000001'),
  1::bigint,
  'new users receive a profile'
);
select is(
  (select currency from public.profiles where user_id = '00000000-0000-0000-0000-000000000001'),
  'MYR',
  'new profiles default to MYR'
);
select results_eq(
  $$select name, type::text, color, is_default
    from public.categories
    where user_id = '00000000-0000-0000-0000-000000000001'
    order by type::text, name$$,
  $$values
    ('Bills', 'expense', '#d39b28', true),
    ('Education', 'expense', '#5776d9', true),
    ('Entertainment', 'expense', '#df66a5', true),
    ('Food', 'expense', '#ef7b66', true),
    ('Health', 'expense', '#2aa883', true),
    ('Others', 'expense', '#78827a', true),
    ('Shopping', 'expense', '#8d7cf7', true),
    ('Transport', 'expense', '#4f8cff', true),
    ('Freelance', 'income', '#4f8cff', true),
    ('Other income', 'income', '#78827a', true),
    ('Salary', 'income', '#2aa883', true)$$,
  'new users receive the exact default category contract'
);

insert into public.accounts (id, user_id, name, kind)
values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'User 1 cash', 'asset'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'User 1 bank', 'asset'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000002', 'User 2 cash', 'asset');

insert into public.transactions (
  user_id,
  type,
  amount_minor,
  account_id,
  category_id,
  merchant,
  transaction_date
)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'expense',
    500,
    '00000000-0000-0000-0000-000000000101',
    (select id from public.categories where user_id = '00000000-0000-0000-0000-000000000001' and name = 'Food'),
    'User 1 merchant',
    '2026-07-01'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'expense',
    700,
    '00000000-0000-0000-0000-000000000201',
    (select id from public.categories where user_id = '00000000-0000-0000-0000-000000000002' and name = 'Food'),
    'User 2 merchant',
    '2026-07-01'
  );

insert into public.budgets (user_id, category_id, month, limit_minor)
values
  (
    '00000000-0000-0000-0000-000000000001',
    (select id from public.categories where user_id = '00000000-0000-0000-0000-000000000001' and name = 'Food'),
    '2026-07-01',
    10000
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    (select id from public.categories where user_id = '00000000-0000-0000-0000-000000000002' and name = 'Food'),
    '2026-07-01',
    12000
  );

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

select results_eq(
  'select count(*) from public.profiles',
  array[1::bigint],
  'a user sees only their own profile'
);
select results_eq(
  'select count(*) from public.categories',
  array[11::bigint],
  'a user sees only their own categories'
);
select results_eq(
  'select count(*) from public.accounts',
  array[2::bigint],
  'a user sees only their own accounts'
);
select results_eq(
  'select count(*) from public.transactions',
  array[1::bigint],
  'a user sees only their own transactions'
);
select results_eq(
  'select count(*) from public.budgets',
  array[1::bigint],
  'a user sees only their own budgets'
);
select results_eq(
  $$update public.accounts
    set name = 'Cross-user update'
    where id = '00000000-0000-0000-0000-000000000201'
    returning id$$,
  $$select null::uuid where false$$,
  'a user cannot update another user account'
);

set local role postgres;

select throws_like(
  $$insert into public.transactions (
      user_id, type, amount_minor, account_id, category_id, transaction_date
    ) values (
      '00000000-0000-0000-0000-000000000001',
      'expense',
      100,
      '00000000-0000-0000-0000-000000000201',
      (select id from public.categories where user_id = '00000000-0000-0000-0000-000000000001' and name = 'Food'),
      '2026-07-02'
    )$$,
  '%transactions_account_owner_fk%',
  'transactions cannot reference an account owned by another user'
);
select throws_like(
  $$insert into public.transactions (
      user_id, type, amount_minor, account_id, to_account_id, transaction_date
    ) values (
      '00000000-0000-0000-0000-000000000001',
      'transfer',
      100,
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000201',
      '2026-07-02'
    )$$,
  '%transactions_to_account_owner_fk%',
  'transactions cannot reference a destination account owned by another user'
);
select throws_like(
  $$insert into public.transactions (
      user_id, type, amount_minor, account_id, category_id, transaction_date
    ) values (
      '00000000-0000-0000-0000-000000000001',
      'expense',
      100,
      '00000000-0000-0000-0000-000000000101',
      (select id from public.categories where user_id = '00000000-0000-0000-0000-000000000002' and name = 'Food'),
      '2026-07-02'
    )$$,
  '%transactions_category_owner_fk%',
  'transactions cannot reference a category owned by another user'
);

select lives_ok(
  $$insert into public.transactions (
      user_id, type, amount_minor, account_id, category_id, transaction_date
    ) values (
      '00000000-0000-0000-0000-000000000001',
      'income',
      100,
      '00000000-0000-0000-0000-000000000101',
      (select id from public.categories where user_id = '00000000-0000-0000-0000-000000000001' and name = 'Salary'),
      '2026-07-03'
    )$$,
  'income accepts an account and income category'
);
select lives_ok(
  $$insert into public.transactions (
      user_id, type, amount_minor, account_id, category_id, transaction_date
    ) values (
      '00000000-0000-0000-0000-000000000001',
      'expense',
      100,
      '00000000-0000-0000-0000-000000000101',
      (select id from public.categories where user_id = '00000000-0000-0000-0000-000000000001' and name = 'Education'),
      '2026-07-03'
    )$$,
  'expense accepts an account and expense category'
);
select lives_ok(
  $$insert into public.transactions (
      user_id, type, amount_minor, account_id, to_account_id, transaction_date
    ) values (
      '00000000-0000-0000-0000-000000000001',
      'transfer',
      100,
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000102',
      '2026-07-03'
    )$$,
  'transfer accepts different owned source and destination accounts'
);

select throws_like(
  $$insert into public.transactions (
      user_id, type, amount_minor, account_id, transaction_date
    ) values (
      '00000000-0000-0000-0000-000000000001',
      'income',
      100,
      '00000000-0000-0000-0000-000000000101',
      '2026-07-04'
    )$$,
  '%transactions_shape_check%',
  'income requires a category'
);
select throws_like(
  $$insert into public.transactions (
      user_id, type, amount_minor, account_id, transaction_date
    ) values (
      '00000000-0000-0000-0000-000000000001',
      'expense',
      100,
      '00000000-0000-0000-0000-000000000101',
      '2026-07-04'
    )$$,
  '%transactions_shape_check%',
  'expense requires a category'
);
select throws_like(
  $$insert into public.transactions (
      user_id, type, amount_minor, account_id, to_account_id, transaction_date
    ) values (
      '00000000-0000-0000-0000-000000000001',
      'transfer',
      100,
      '00000000-0000-0000-0000-000000000102',
      '00000000-0000-0000-0000-000000000102',
      '2026-07-02'
    )$$,
  '%transactions_shape_check%',
  'transfers require different source and destination accounts'
);
select throws_like(
  $$delete from public.accounts where id = '00000000-0000-0000-0000-000000000101'$$,
  '%transactions_account_owner_fk%',
  'referenced accounts cannot be deleted'
);
select throws_like(
  $$insert into public.budgets (user_id, category_id, month, limit_minor)
    values (
      '00000000-0000-0000-0000-000000000001',
      (select id from public.categories where user_id = '00000000-0000-0000-0000-000000000001' and name = 'Food'),
      '2026-07-01',
      15000
    )$$,
  '%budgets_user_id_category_id_month_key%',
  'a category has at most one budget per month'
);

select table_privs_are('public', 'profiles', 'authenticated', array['DELETE', 'INSERT', 'SELECT', 'UPDATE'], 'authenticated has CRUD-only privileges on profiles');
select table_privs_are('public', 'profiles', 'anon', array[]::text[], 'anon has no privileges on profiles');
select table_privs_are('public', 'categories', 'authenticated', array['DELETE', 'INSERT', 'SELECT', 'UPDATE'], 'authenticated has CRUD-only privileges on categories');
select table_privs_are('public', 'categories', 'anon', array[]::text[], 'anon has no privileges on categories');
select table_privs_are('public', 'accounts', 'authenticated', array['DELETE', 'INSERT', 'SELECT', 'UPDATE'], 'authenticated has CRUD-only privileges on accounts');
select table_privs_are('public', 'accounts', 'anon', array[]::text[], 'anon has no privileges on accounts');
select table_privs_are('public', 'transactions', 'authenticated', array['DELETE', 'INSERT', 'SELECT', 'UPDATE'], 'authenticated has CRUD-only privileges on transactions');
select table_privs_are('public', 'transactions', 'anon', array[]::text[], 'anon has no privileges on transactions');
select table_privs_are('public', 'budgets', 'authenticated', array['DELETE', 'INSERT', 'SELECT', 'UPDATE'], 'authenticated has CRUD-only privileges on budgets');
select table_privs_are('public', 'budgets', 'anon', array[]::text[], 'anon has no privileges on budgets');

select * from finish();
rollback;
