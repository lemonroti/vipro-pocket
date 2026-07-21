revoke all privileges on table
  public.profiles,
  public.categories,
  public.accounts,
  public.transactions,
  public.budgets
from authenticated, anon;

grant select, insert, update, delete on table
  public.profiles,
  public.categories,
  public.accounts,
  public.transactions,
  public.budgets
to authenticated;
