import { fmtMoney } from './api';

export interface Activity {
  id: number; at: string; userId: number | null; userName: string;
  entity: string; entityId: string; action: string; details: Record<string, any>;
}

const FIELD: Record<string, string> = {
  clientName: 'Mijoz ismi', clientPhone: 'Telefon', latitude: 'Lokatsiya (kenglik)', longitude: 'Lokatsiya (uzunlik)',
  landmark: 'Orientir', pickupPlannedAt: 'Olib ketish vaqti', fullName: 'Ism', role: 'Rol', isActive: 'Faol',
  name: 'Nomi', phone: 'Telefon', defaultPrice: 'Standart narx', unit: "O'lchov birligi",
};
const formatPhoneLine = (p: string) => `Telefon: ${p}`;
const show = (v: unknown) => (v === true ? 'ha' : v === false ? "yo'q" : v === '' || v == null ? '—' : String(v));
const changes = (c: Record<string, { from: unknown; to: unknown }> | undefined) =>
  Object.entries(c ?? {}).map(([k, v]) => `${FIELD[k] ?? k}: ${show(v.from)} → ${show(v.to)}`);

export const ENTITY_LABEL: Record<string, string> = {
  order: 'Zakaz', client: 'Mijoz', user: 'Foydalanuvchi', role: 'Rol', service: 'Xizmat', expense_type: 'Xarajat turi', expense: 'Xarajat', branding: 'Loyiha',
};

/** Human text (Uzbek) for one audit entry: a headline plus detail lines. */
export function describe(a: Activity): { title: string; lines: string[] } {
  const d = a.details;
  const status = d.from && d.to ? [`${d.from} → ${d.to}`] : [];
  switch (a.action) {
    case 'order.created': return { title: 'Zakaz yaratildi', lines: [`Mijoz: ${d.client} (${d.phone})`, ...((d.services as string[]) ?? [])] };
    case 'order.edited': {
      const c = changes(d.changes);
      return { title: 'Zakaz tahrirlandi', lines: c.length ? c : ["O'zgarish yo'q"] };
    }
    case 'order.pickedup': return { title: 'Olib ketildi', lines: [...status, `Nakladnoy: ${d.waybill}`, `Yetkazish vaqti: ${String(d.deliveryTime ?? '').slice(0, 16)}`] };
    case 'order.washed': return { title: "Yuvib bo'lindi", lines: [...status, ...((d.counts as { service: string; picked: number; washed: number }[]) ?? []).map((c) => `${c.service}: olingan ${c.picked} → yuvilgan ${c.washed} dona`)] };
    case 'order.packed': return { title: 'Upakovka qilindi', lines: [...status, ...((d.counts as { service: string; picked: number; washed: number; packed: number }[]) ?? []).map((c) => `${c.service}: olingan ${c.picked}, yuvilgan ${c.washed}, upakovka ${c.packed} dona`)] };
    case 'order.delivered': return {
      title: 'Yetkazib berildi',
      lines: [...status, `Jami: ${fmtMoney(d.docTotal)}`, ...(d.discount > 0 ? [`Chegirma: ${fmtMoney(d.discount)}`] : []), `To'langan: ${fmtMoney(d.paid)}`, `Qarz: ${fmtMoney(d.debt)}`],
    };
    case 'order.cancelled': return { title: 'Bekor qilindi', lines: [...status, `Sabab: ${d.reason}`] };
    case 'order.payment': return {
      title: d.amount > 0 && d.discount > 0 ? "To'lov va chegirma" : d.discount > 0 ? 'Chegirma berildi' : "To'lov qabul qilindi",
      lines: [...(d.amount > 0 ? [`To'lov: ${fmtMoney(d.amount)}`] : []), ...(d.discount > 0 ? [`Chegirma: ${fmtMoney(d.discount)}`] : []), `Qolgan qarz: ${fmtMoney(d.debtLeft)}`],
    };
    case 'client.created': return { title: `Mijoz qo'shildi: ${d.name}`, lines: [formatPhoneLine(d.phone), ...(d.via === 'order' ? ['Zakaz orqali avtomatik saqlandi'] : [])] };
    case 'client.updated': return { title: "Mijoz o'zgartirildi", lines: changes(d.changes) };
    case 'client.deleted': return { title: `Mijoz o'chirildi: ${d.name}`, lines: [] };
    case 'client.address_added': return { title: "Manzil qo'shildi", lines: [d.landmark || `${d.latitude}, ${d.longitude}`] };
    case 'client.address_updated': return { title: "Manzil o'zgartirildi", lines: changes(d.changes) };
    case 'client.address_deleted': return { title: "Manzil o'chirildi", lines: [d.landmark || ''] };
    case 'comment.added': return { title: 'Izoh qo\'shildi', lines: [String(d.text)] };
    case 'comment.deleted': return { title: "Izoh o'chirildi", lines: [`${d.author}: ${d.text}`] };
    case 'user.created': return { title: `Foydalanuvchi yaratildi: ${d.username}`, lines: [`Ism: ${d.fullName}`, `Rol: ${d.role}`] };
    case 'user.updated': return { title: `Foydalanuvchi o'zgartirildi: ${d.username}`, lines: [...changes(d.changes), ...(d.passwordChanged ? ["Parol o'zgartirildi"] : [])] };
    case 'role.created': return { title: `Rol yaratildi: ${d.name}`, lines: [`Huquqlar: ${(d.permissions as string[]).length} ta`] };
    case 'role.updated': return {
      title: 'Rol o\'zgartirildi',
      lines: [...(d.name ? [`Nomi: ${d.name.from} → ${d.name.to}`] : []), ...(d.permissions ? [`Huquqlar: ${d.permissions.from.length} → ${d.permissions.to.length} ta`] : [])],
    };
    case 'role.deleted': return { title: `Rol o'chirildi: ${d.name}`, lines: [] };
    case 'service.created': case 'expense_type.created': return { title: `${ENTITY_LABEL[a.entity]} qo'shildi: ${d.name}`, lines: d.defaultPrice != null ? [`Narx: ${fmtMoney(d.defaultPrice)}/${d.unit}`] : [] };
    case 'service.updated': case 'expense_type.updated': return { title: `${ENTITY_LABEL[a.entity]} o'zgartirildi: ${d.name}`, lines: changes(d.changes) };
    case 'expense.created': return { title: `Xarajat: ${d.type}`, lines: [`Summa: ${fmtMoney(d.amount)}`, `Sana: ${d.date}`] };
    case 'branding.updated': return { title: "Loyiha sozlamalari o'zgartirildi", lines: [`O'zgargan: ${(d.fields as string[]).join(', ')}`] };
    default: return { title: a.action, lines: [] };
  }
}
