import { fmtMoney } from '../../api';

/** Money for the saygak portal: whole so'm, or 2 decimals when the amount is fractional. */
export const money = (n: number | undefined | null): string => {
  const v = Number(n ?? 0);
  if (Number.isInteger(v)) return fmtMoney(v);
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + " so'm";
};

export const num = (n: number): string => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n);
