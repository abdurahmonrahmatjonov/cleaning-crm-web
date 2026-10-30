import { formatPhone } from '../format';
import { useCallback, useEffect, useState } from 'react';
import { api, fmtMoney } from '../api';
import type { Debtor } from '../types';
import { Empty, Loading } from '../components/ui';
import { ClientModal } from './Clients';

export default function Debtors() {
  const [rows, setRows] = useState<Debtor[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);

  const load = useCallback(() => {
    api<{ data: Debtor[]; meta: { totalDebt: number } }>('/reports/debtors')
      .then((r) => { setRows(r.data); setTotal(r.meta.totalDebt); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Qarzdorlar</h1>
        <p className="text-sm text-gray-500">Jami qarz: <b className="text-red-600">{fmtMoney(total)}</b></p>
      </div>
      <div className="card overflow-hidden">
        {loading ? <Loading /> : rows.length === 0 ? <Empty text="Qarzdorlar yo'q" /> : (
          <>
          <ul className="divide-y divide-gray-100 sm:hidden">
            {rows.map((d) => (
              <li key={d.clientId} onClick={() => setSelected(d.clientId)} className="cursor-pointer px-4 py-3.5 transition-colors active:bg-gray-50">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-semibold">{d.name}</span>
                  <span className="shrink-0 font-semibold text-red-600">{fmtMoney(d.debt)}</span>
                </div>
                <div className="mt-1 flex justify-between text-sm text-gray-500"><span>{formatPhone(d.phone)}</span><span>{d.ordersCount} ta zakaz</span></div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="rtable w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr><th className="th">Mijoz</th><th className="th">Telefon</th><th className="th !text-right">Zakazlar</th><th className="th !text-right">Qarz</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((d) => (
                  <tr key={d.clientId} onClick={() => setSelected(d.clientId)} className="cursor-pointer hover:bg-gray-50">
                    <td data-label="Mijoz" className="td font-medium">{d.name}</td>
                    <td data-label="Telefon" className="td text-gray-600">{formatPhone(d.phone)}</td>
                    <td data-label="Zakazlar" className="td text-right">{d.ordersCount}</td>
                    <td data-label="Qarz" className="td text-right font-medium text-red-600">{fmtMoney(d.debt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
      {selected && <ClientModal id={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}
