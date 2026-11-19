import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import FilterBar from '../components/FilterBar.jsx';
import TransactionModal from '../components/TransactionModal.jsx';
import { api, date, getErrorMessage, money } from '../services/api.js';

export default function TransactionsPage() {
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    api.categories().then(setCategories).catch((err) => setError(getErrorMessage(err)));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, type, category]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const timer = window.setTimeout(async () => {
      try {
        const request = search.trim() ? api.searchTransactions : api.transactions;
        const result = await request({ q: search.trim(), type, category, page, limit: 20 });
        if (active) {
          setTransactions(result.data);
          setPagination(result.pagination);
        }
      } catch (err) {
        if (active) setError(getErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    }, search.trim() ? 250 : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search, type, category, page, refresh]);

  async function remove(transaction) {
    if (!window.confirm(`Supprimer « ${transaction.titre} » ?`)) return;
    try {
      await api.deleteTransaction(transaction._id);
      setRefresh((value) => value + 1);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">VOTRE QUOTIDIEN FINANCIER</p><h1>Transactions</h1><p className="page-subtitle">Toutes vos opérations, au même endroit.</p></div>
        <Link className="button button-primary" to="/transactions/new"><span aria-hidden="true">＋</span> Nouvelle opération</Link>
      </div>
      <div className="list-toolbar"><strong>{pagination.total.toLocaleString('fr-FR')} <span>opérations</span></strong><span>Historique de vos finances</span></div>
      <FilterBar search={search} setSearch={setSearch} type={type} setType={setType} category={category} setCategory={setCategory} categories={categories} />
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <section className="table-card">
        <div className="table-scroll">
          <table>
            <thead><tr><th>Date</th><th>Transaction</th><th>Catégorie</th><th>Type</th><th>Montant</th><th>Tags</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {loading ? <tr><td className="table-message" colSpan="7">Chargement des transactions…</td></tr>
                : transactions.length === 0 ? <tr><td className="table-message" colSpan="7">Aucune transaction trouvée. Modifiez les filtres ou ajoutez une opération.</td></tr>
                  : transactions.map((item) => (
                    <tr key={item._id}>
                      <td className="muted-cell">{date(item.date_transaction)}</td>
                      <td><button className="text-button transaction-title" onClick={() => setSelected(item)}>{item.titre}</button></td>
                      <td><span className="category-cell"><span className="category-dot" />{item.categorie_id?.nom || '—'}</span></td>
                      <td><span className={`type-badge ${item.type === 'Revenu' ? 'income' : 'expense'}`}>{item.type}</span></td>
                      <td className={`amount-cell ${item.type === 'Revenu' ? 'positive' : 'negative'}`}>{item.type === 'Revenu' ? '+' : '−'} {money(item.montant_total)}</td>
                      <td><div className="tag-row">{(item.tags || []).slice(0, 2).map((tag) => <span className="tag" key={tag}>{tag}</span>)}{item.tags?.length > 2 && <span className="tag tag-more">+{item.tags.length - 2}</span>}</div></td>
                      <td><div className="row-actions">
                        <button className="action-button" onClick={() => setSelected(item)} title="Détails" aria-label={`Détails de ${item.titre}`}>Voir</button>
                        <Link className="action-button" to={`/transactions/${item._id}/edit`} aria-label={`Modifier ${item.titre}`}>Éditer</Link>
                        <button className="action-button action-delete" onClick={() => remove(item)} aria-label={`Supprimer ${item.titre}`}>×</button>
                      </div></td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span>Page {pagination.pages ? pagination.page : 0} sur {pagination.pages}</span>
          <div><button className="button button-small button-secondary" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>← Précédent</button>
            <button className="button button-small button-secondary" disabled={page >= pagination.pages || loading} onClick={() => setPage((value) => value + 1)}>Suivant →</button></div>
        </div>
      </section>
      <TransactionModal transaction={selected} onClose={() => setSelected(null)} />
    </>
  );
}
