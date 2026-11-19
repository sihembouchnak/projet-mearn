import { NavLink } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const [logoutError, setLogoutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    setLogoutError('');
    try {
      await logout();
    } catch (error) {
      setLogoutError(error.response?.data?.message || 'La déconnexion a échoué. Réessayez.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header className="topbar">
      <NavLink className="brand" to="/transactions" aria-label="BudgetTracker accueil">
        <span className="brand-mark">B</span>
        <span>budget<span className="brand-light">tracker</span></span>
      </NavLink>
      {user ? <>
        <nav className="nav-links" aria-label="Navigation principale">
          {user.role === 'admin' && <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Administration</NavLink>}
          <NavLink to="/transactions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Transactions
          </NavLink>
          <NavLink to="/stats" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Statistiques
          </NavLink>
        </nav>
        <div className="account-actions">
          <div className="profile-chip"><span className="profile-avatar">{user.nom_complet.charAt(0).toUpperCase()}</span><span>{user.nom_complet}</span></div>
          <button className="logout-button" onClick={handleLogout} disabled={signingOut}>{signingOut ? '…' : 'Déconnexion'}</button>
        </div>
      </> : loading ? <div className="profile-chip"><span className="profile-avatar">…</span></div> : <nav className="nav-links auth-nav" aria-label="Navigation principale">
        <NavLink to="/login" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Connexion</NavLink>
        <NavLink to="/register" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Inscription</NavLink>
      </nav>}
      {logoutError && <span className="nav-error" role="alert">{logoutError}</span>}
    </header>
  );
}
