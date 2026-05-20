update public.categories
set
    color = '#64748b',
    updated_at = now()
where type = 'expense'
  and color is distinct from '#64748b';
