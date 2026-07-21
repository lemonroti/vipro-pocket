begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(24);

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
  'new users receive a MYR profile'
);
select is(
  (select count(*) from public.categories where user_id = '00000000-0000-0000-0000-000000000001' and is_default),
  11::bigint,
  'new users receive the complete default category set'
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

select table_privs_are(
  'public',
  'accounts',
  'authenticated',
  array['DELETE', 'INSERT', 'SELECT', 'UPDATE'],
  'authenticated users can access accounts through the Data API'
);
select table_privs_are(
  'public',
  'accounts',
  'anon',
  array[]::text[],
  'anonymous users have no accounts table privilege'
);

select * from finish();
rollback;
