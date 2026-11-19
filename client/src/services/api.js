import axios from 'axios';

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

export const api = {
  register: async (data) => (await http.post('/auth/register', data)).data,
  login: async (data) => (await http.post('/auth/login', data)).data,
  logout: async () => (await http.post('/auth/logout')).data,
  currentUser: async () => (await http.get('/auth/me')).data,
  categories: async () => (await http.get('/categories')).data,
  transactions: async (params = {}) => (await http.get('/transactions', { params })).data,
  searchTransactions: async (params = {}) => (await http.get('/transactions/search', { params })).data,
  transaction: async (id) => (await http.get(`/transactions/${id}`)).data,
  createTransaction: async (data) => (await http.post('/transactions', data)).data,
  updateTransaction: async (id, data) => (await http.put(`/transactions/${id}`, data)).data,
  deleteTransaction: async (id) => (await http.delete(`/transactions/${id}`)).data,
  categoryStats: async () => (await http.get('/stats/by-category')).data,
  monthlyStats: async () => (await http.get('/stats/monthly')).data
};

export function getErrorMessage(error) {
  return error.response?.data?.message || error.message || 'Une erreur inattendue est survenue.';
}

export const money = (value) => new Intl.NumberFormat('fr-TN', {
  style: 'currency',
  currency: 'TND',
  maximumFractionDigits: 2
}).format(Number(value) || 0);

export const date = (value) => value
  ? new Intl.DateTimeFormat('fr-FR').format(new Date(value))
  : '—';
