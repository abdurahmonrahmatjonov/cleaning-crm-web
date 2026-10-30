export type Unit = 'kv.m' | 'metr' | 'dona';
export const UNITS: Unit[] = ['kv.m', 'metr', 'dona'];
export type Role = string;
export type Permission =
  | 'orders.view' | 'orders.create' | 'orders.edit' | 'orders.pickup' | 'orders.wash' | 'orders.pack' | 'orders.deliver'
  | 'orders.payments' | 'orders.discount' | 'clients.manage' | 'clients.view' | 'debtors.view' | 'expenses.manage' | 'reports.view';
export interface User { id: number; username: string; fullName: string; role: Role; roleName?: string; permissions: Permission[] }
export interface RoleInfo { key: string; name: string; isSystem: boolean; permissions: Permission[]; usersCount: number }
export interface Branding {
  name: string; logo: string | null;
  loginTitle: string | null; loginSubtitle: string | null; loginBackground: string | null; loginColor: string | null;
}
export interface Line {
  id: number; serviceId: number; serviceName: string; status: string;
  unit: Unit; pickedQuantity: number; washedQuantity: number; price: number; customerPrice: number; quantity: number; sqm: number; lineTotal: number; currency: string;
}
export interface Order {
  docNum: number; status: string; clientName: string; clientPhone: string;
  location: { latitude: number; longitude: number }; landmark: string; pickupTime: string;
  createdBy: { id: number; name: string }; docTotal: number; discount: number; paid: number; debt: number;
  createdAt: string; orderTakenAt: string; deliveryTime: string; pickedUpAt: string; washedAt: string; packedAt: string;
  deliveredDate: string; deliveredAt: string; waybillNumber: string;
  pickedUpBy: string; washedBy: string; packedBy: string; deliveredBy: string; cancelReason: string; cancelledAt: string; lines: Line[];
}
export interface Named { id: number; name: string }
export interface Expense {
  id: number; expenseTypeId: number; expenseType: string; amount: number;
  expenseDate: string; createdAt: string; creator: string | { name: string };
}
export interface Page<T> { data: T[]; meta: { page: number; limit: number; total: number; totalAmount?: number } }
export interface Client { id: number; name: string; phone: string; createdAt: string; ordersCount: number; debt: number }
export interface Address { id: number; latitude: number; longitude: number; landmark: string; lastUsedAt: string }
export interface ClientDetail extends Client {
  addresses: Address[];
  orders: { docNum: number; status: string; docTotal: number; paid: number; createdAt: string; deliveredDate: string }[];
}
export interface Debtor { clientId: number; name: string; phone: string; ordersCount: number; debt: number }
export interface Payment { amount: number; discount?: number; paidDate: string; [k: string]: unknown }
export interface ManagedUser { id: number; username: string; fullName: string; role: Role; isActive: boolean; createdAt: string }
export interface DictItem { id: number; name: string; isActive: boolean; defaultPrice?: number; unit?: Unit }
export interface Summary {
  from: string; to: string;
  ordersByStatus: { status: string; count: number }[];
  sales: { ordersCount: number; total: number; discount: number; totalSqm: number };
  collected: number;
  expenses: { total: number; byType: { expenseType: string; total: number }[] };
  netCash: number; outstandingDebt: number;
}
