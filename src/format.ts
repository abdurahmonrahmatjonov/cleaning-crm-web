/** "+998901234567" -> "+998 90 123 45 67". Anything that isn't a UZ number is returned as-is. */
export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (!/^998\d{9}$/.test(d)) return raw;
  return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10, 12)}`;
}

/** Typed/pasted text -> canonical "+998XXXXXXXXX" (at most 9 digits after the code). */
export function normalizePhone(input: string): string {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('998')) d = d.slice(3);
  else if (d.length <= 3 && '998'.startsWith(d)) d = ''; // user is erasing the prefix
  return '+998' + d.slice(0, 9);
}

/** Progressive display of a canonical phone while typing: "+998 90 123 45 67". */
export function maskPhone(canon: string): string {
  const d = canon.replace(/\D/g, '').slice(3);
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return ['+998', ...parts].join(' ') + (parts.length === 0 ? ' ' : '');
}

/** "1500000" -> "1 500 000"; keeps a decimal part if present. */
export function formatNumber(raw: string): string {
  if (raw === '') return '';
  const [int, dec] = raw.split('.');
  const g = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return dec === undefined ? g : `${g}.${dec}`;
}

/** Display text -> raw numeric string (digits, optional single dot). */
export function parseNumber(text: string, decimal: boolean): string {
  let t = text.replace(/[^\d.,]/g, '').replace(',', '.');
  if (!decimal) t = t.replace(/\./g, '');
  const i = t.indexOf('.');
  if (i !== -1) t = t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, '').slice(0, 2);
  return t.replace(/^0+(?=\d)/, '');
}
