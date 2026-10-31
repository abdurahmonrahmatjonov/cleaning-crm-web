export const num = (n: number): string => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n);
