export type Unit = 'kv.m' | 'metr' | 'dona';
export const UNITS: Unit[] = ['kv.m', 'metr', 'dona'];
export type Role = string;
export type Permission =
  | 'orders.view' | 'orders.create' | 'orders.edit' | 'orders.pickup' | 'orders.wash' | 'orders.pack' | 'orders.deliver'
  | 'orders.payments' | 'orders.discount' | 'clients.manage' | 'clients.view' | 'debtors.view' | 'expenses.manage' | 'reports.view';
export interface User { id: number; username: string; fullName: string; role: Role; roleName?: string; permissions: Permission[]; clientId: number | null }
export interface RoleInfo { key: string; name: string; isSystem: boolean; permissions: Permission[]; usersCount: number }
export interface Branding {
  name: string; logo: string | null;
  loginTitle: string | null; loginSubtitle: string | null; loginBackground: string | null; loginColor: string | null;
}
export interface LineSize { width: number; length: number; area: number }
export interface Line {
  id: number; serviceId: number; serviceName: string; status: string;
  unit: Unit; pickedQuantity: number; washedQuantity: number; price: number; customerPrice: number; quantity: number; sqm: number; lineTotal: number; currency: string;
  expectedQuantity: number; sizes: LineSize[]; sizesTotal: number;
}
export interface Order {
  docNum: number; kind: 'regular' | 'partner'; status: string; clientName: string; clientPhone: string;
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
/** The API sends `isPartner` as 0/1 from client endpoints; test it with `isPartnerClient`. */
export interface Client { id: number; name: string; phone: string; isPartner: number | boolean; createdAt: string; ordersCount: number; debt: number }
export const isPartnerClient = (c: { isPartner?: number | boolean } | null | undefined): boolean => !!c?.isPartner;
export interface Address { id: number; latitude: number; longitude: number; landmark: string; lastUsedAt: string }
export interface ClientDetail extends Client {
  addresses: Address[];
  orders: { docNum: number; kind: 'regular' | 'partner'; status: string; docTotal: number; paid: number; createdAt: string; deliveredDate: string }[];
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

export interface ClientPrice { serviceId: number; serviceName: string; unit: Unit; price: number | null }
export interface PaymentBatch {
  batchId: string; clientId: number; amount: number; discount: number; paidDate: string; createdAt: string;
  creatorId: number; creatorName: string; allocations: { docNum: number; cash: number; disc: number }[];
  reversedAt: string; reversedByName: string;
}
export interface Statement {
  month: string; opening: number; charges: number; credits: number; closing: number;
  orders: { docNum: number; deliveredDate: string; docTotal: number; sqmTotal: number }[];
  payments: { batchId: string; paidDate: string; amount: number; discount: number }[];
  inProgress: { docNum: number; status: string; createdAt: string }[];
}
/** Saygak's view of an order. Amount fields exist only after handover (status 'Yetkazib berildi'). */
export interface PartnerOrderLine {
  id: number; serviceName: string; unit: Unit; expectedQuantity: number;
  quantity: number | null; sizes: LineSize[]; sizesTotal: number;
  price?: number; sqm?: number; lineTotal?: number;
}
export interface PartnerOrder {
  docNum: number; status: string; createdAt: string; deliveredDate: string; cancelledAt: string;
  lines: PartnerOrderLine[];
  docTotal?: number; discount?: number; paid?: number; debt?: number;
}
export interface PartnerMe {
  client: { id: number; name: string; phone: string };
  inProgressOrders: number; receivedOrders: number; orderCap: number; debt: number;
}
/** `GET /partner/services` (a plain array): services with a price for this saygak. */
export interface PartnerService { id: number; name: string; unit: Unit; price: number }
