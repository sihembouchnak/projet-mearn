import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useAuth } from './contexts/AuthContext.jsx';
import AddTransactionPage from './pages/AddTransactionPage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import TransactionsPage from './pages/TransactionsPage.jsx';

const StatsPage = lazy(() => import('./pages/StatsPage.jsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));

export default function App() {
  const { user } = useAuth();

  return (
    <div className="app-shell">
      <Navbar />
      <main className="main-content">
        <Suspense fallback={<p className="loading-screen">Chargement…</p>}>
          <Routes>
            <Route path="/" element={<Navigate to={user ? '/transactions' : '/login'} replace />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route element={<ProtectedRoute><Outlet /></ProtectedRoute>}>
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/transactions/new" element={<AddTransactionPage />} />
              <Route path="/transactions/:id/edit" element={<AddTransactionPage />} />
              <Route path="/stats" element={<StatsPage />} />
            </Route>
            <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to={user ? '/transactions' : '/login'} replace />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="footer">BudgetTracker <span>•</span> Gérez mieux, dépensez sereinement.</footer>
    </div>
  );
}
