import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const { user, register, login, error: sessionError } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/transactions" replace />;

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (isRegister && password !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setSubmitting(true);
    try {
      if (isRegister) await register({ nom_complet: name, email, password });
      else await login({ email, password });
      const destination = location.state?.from?.pathname || '/transactions';
      navigate(destination, { replace: true });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><span className="brand-mark">B</span><span>budget<span className="brand-light">tracker</span></span></div>
        <p className="eyebrow">{isRegister ? 'VOTRE BUDGET, VOTRE ESPACE' : 'RAVI DE VOUS REVOIR'}</p>
        <h1>{isRegister ? 'Créer un compte' : 'Connexion'}</h1>
        <p className="auth-description">{isRegister
          ? 'Créez votre espace personnel pour suivre vos revenus et vos dépenses.'
          : 'Connectez-vous pour retrouver vos transactions et vos statistiques.'}</p>
        {(error || sessionError) && <div className="alert alert-error" role="alert">{error || sessionError}</div>}
        <form className="auth-form" onSubmit={submit}>
          {isRegister && <label className="form-field">Nom complet
            <input autoComplete="name" required minLength="2" maxLength="80" value={name} onChange={(event) => setName(event.target.value)} placeholder="Votre nom" />
          </label>}
          <label className="form-field">Adresse e-mail
            <input autoComplete="email" required type="email" maxLength="254" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@exemple.com" />
          </label>
          <label className="form-field">Mot de passe
            <input autoComplete={isRegister ? 'new-password' : 'current-password'} required type="password" minLength="8" maxLength="72" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isRegister ? '8 caractères minimum' : 'Votre mot de passe'} />
            {isRegister && <small className="auth-hint">Au moins 8 caractères. Votre mot de passe est stocké sous forme hachée.</small>}
          </label>
          {isRegister && <label className="form-field">Confirmer le mot de passe
            <input autoComplete="new-password" required type="password" minLength="8" maxLength="72" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Retapez votre mot de passe" />
          </label>}
          <button className="button button-primary auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Patientez…' : isRegister ? 'Créer mon compte' : 'Se connecter'}
          </button>
        </form>
        <p className="auth-switch">{isRegister ? 'Vous avez déjà un compte ?' : 'Pas encore de compte ?'}{' '}
          <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Se connecter' : 'Créer un compte'}</Link>
        </p>
      </section>
    </div>
  );
}
