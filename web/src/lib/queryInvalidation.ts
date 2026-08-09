const FINANCE_QUERY_KEYS = [
  ['transactions'],
  ['all-transactions'],
  ['wallets'],
  ['calculated-wallets'],
  ['dashboard'],
  ['budgets'],
  ['goals'],
  ['trips'],
  ['contacts'],
  ['categories'],
  ['debts'],
];

export async function invalidateFinanceQueries(queryClient) {
  await Promise.all(
    FINANCE_QUERY_KEYS.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
}

export function resetFinanceQueries(queryClient) {
  FINANCE_QUERY_KEYS.forEach((queryKey) => {
    queryClient.removeQueries({ queryKey });
  });
}
