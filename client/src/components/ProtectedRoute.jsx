import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { user, loading, error, retryLoading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="loading-screen">Vérification de votre session…</p>;
  if (error) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-icon">!</div>
          <h1>Connexion impossible</h1>
          <p className="auth-description">{error}</p>
          <button className="button button-primary auth-submit" onClick={retryLoading}>Réessayer</button>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  return children;
}
