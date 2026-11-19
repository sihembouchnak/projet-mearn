import { createContext, useContext, useEffect, useState } from 'react';
import { api, getErrorMessage } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    api.currentUser()
      .then(({ user: currentUser }) => {
        if (active) {
          setUser(currentUser);
          setError('');
        }
      })
      .catch((requestError) => {
        if (!active) return;
        if (requestError.response?.status === 401) {
          setUser(null);
          setError('');
        } else {
          setError(getErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [retry]);

  async function register(data) {
    const result = await api.register(data);
    setUser(result.user);
    setError('');
  }

  async function login(data) {
    const result = await api.login(data);
    setUser(result.user);
    setError('');
  }

  async function logout() {
    try {
      await api.logout();
    } catch (requestError) {
      if (requestError.response?.status !== 401) throw requestError;
    }
    setUser(null);
    setError('');
  }

  const value = {
    user,
    loading,
    error,
    register,
    login,
    logout,
    retryLoading: () => { setError(''); setLoading(true); setRetry((value) => value + 1); }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit etre utilise dans AuthProvider.');
  return context;
}
