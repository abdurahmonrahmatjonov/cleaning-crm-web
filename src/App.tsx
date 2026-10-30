import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import Login from './pages/Login';

const Orders = lazy(() => import('./pages/Orders'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Clients = lazy(() => import('./pages/Clients'));
const Debtors = lazy(() => import('./pages/Debtors'));
const Summary = lazy(() => import('./pages/Summary'));
const Users = lazy(() => import('./pages/Users'));
const Dictionaries = lazy(() => import('./pages/Dictionaries'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const Roles = lazy(() => import('./pages/Roles'));
const Chat = lazy(() => import('./pages/Chat'));
const ActivityPage = lazy(() => import('./pages/Activity'));

export default function App() {
  const { user, loading, can, isAdmin } = useAuth();
  if (loading) return <div className="grid h-screen place-items-center text-gray-400">Yuklanmoqda…</div>;
  if (!user) return <Login />;
  return (
    <Routes>
      <Route element={<Layout />}>
        {can('orders.view') && <Route path="/sales/:tab" element={<Orders />} />}
        {can('clients.view') && <Route path="/clients" element={<Clients />} />}
        <Route path="/chat" element={<Chat />} />
        <Route path="/settings" element={<SettingsPage />} />
        {can('expenses.manage') && <Route path="/expenses" element={<Expenses />} />}
        {can('debtors.view') && <Route path="/debtors" element={<Debtors />} />}
        {can('reports.view') && <Route path="/summary" element={<Summary />} />}
        {isAdmin && <Route path="/users" element={<Users />} />}
        {isAdmin && <Route path="/dictionaries" element={<Dictionaries />} />}
        {isAdmin && <Route path="/roles" element={<Roles />} />}
        {isAdmin && <Route path="/activity" element={<ActivityPage />} />}
        <Route path="*" element={<Navigate to={can('orders.view') ? '/sales/received' : '/settings'} replace />} />
      </Route>
    </Routes>
  );
}
