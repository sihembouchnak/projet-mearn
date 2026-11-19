import { useEffect, useState } from 'react';
import { api, date, getErrorMessage, money } from '../services/api.js';

const tabs = [
  { id: 'dashboard', label: 'Vue générale' },
  { id: 'users', label: 'Comptes clients' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'categories', label: 'Catégories' }
];

const statusLabels = { pending: 'En attente', approved: 'Approuvé', rejected: 'Refusé' };

export default function AdminPage() {
  const [tab, setTab] = useState('dashboard');
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [userStatus, setUserStatus] = useState('pending');
  const [userSearch, setUserSearch] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [clients, setClients] = useState([]);
  const [transactionSearch, setTransactionSearch] = useState('');
  const [transactionDraft, setTransactionDraft] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoryForm, setCategoryForm] = useState({ nom: '', description: '', plafond_mensuel: '' });
  const [editingCategory, setEditingCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const [summary, userResult, transactionResult, categoryList, clientResult] = await Promise.all([
          api.adminOverview(),
          api.adminUsers({ status: userStatus, q: userSearch.trim(), limit: 50 }),
          api.adminTransactions({ q: transactionSearch.trim(), limit: 20 }),
          api.adminCategories(),
          api.adminUsers({ status: 'approved', limit: 100 })
        ]);
        if (!active) return;
        setOverview(summary);
        setUsers(userResult.data);
        setTransactions(transactionResult.data);
        setCategories(categoryList);
        setClients(clientResult.data.filter((user) => user.role === 'client'));
      } catch (requestError) {
        if (active) setError(getErrorMessage(requestError));
      } finally {
        if (active) setLoading(false);
      }
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [refresh, userStatus, userSearch, transactionSearch]);

  async function changeStatus(user, status) {
    if (status === 'rejected' && !window.confirm(`Refuser la demande de ${user.nom_complet} ?`)) return;
    setError('');
    try {
      await api.adminUpdateUserStatus(user.id, status);
      setRefresh((value) => value + 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  function openTransaction(transaction = null) {
    if (transaction) {
      const localDate = new Date(transaction.date_transaction);
      localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
      setTransactionDraft({
        ...transaction,
        categorie_id: transaction.categorie_id?._id || transaction.categorie_id,
        user_id: transaction.user_id?._id || transaction.user_id,
        date_transaction: localDate.toISOString().slice(0, 16),
        montant_total: transaction.montant_total,
        tags: (transaction.tags || []).join(', ')
      });
      return;
    }
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setTransactionDraft({
      titre: '',
      type: 'Dépense',
      categorie_id: categories[0]?._id || '',
      user_id: clients[0]?.id || '',
      date_transaction: now.toISOString().slice(0, 16),
      mode_paiement: 'Autre',
      montant_total: '',
      tags: '',
      details_articles: []
    });
  }

  async function saveTransaction(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    const payload = {
      titre: transactionDraft.titre.trim(),
      type: transactionDraft.type,
      categorie_id: transactionDraft.categorie_id,
      date_transaction: new Date(transactionDraft.date_transaction).toISOString(),
      mode_paiement: transactionDraft.mode_paiement || 'Autre',
      tags: transactionDraft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      details_articles: transactionDraft.details_articles || [],
      montant_total: Number(transactionDraft.montant_total)
    };
    try {
      if (transactionDraft._id) {
        await api.adminUpdateTransaction(transactionDraft._id, payload);
      } else {
        await api.adminCreateTransaction({ ...payload, user_id: transactionDraft.user_id });
      }
      setTransactionDraft(null);
      setRefresh((value) => value + 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function removeTransaction(transaction) {
    if (!window.confirm(`Supprimer « ${transaction.titre} » du compte de ${transaction.user_id?.nom_complet || 'ce client'} ?`)) return;
    setError('');
    try {
      await api.adminDeleteTransaction(transaction._id);
      setRefresh((value) => value + 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  async function saveCategory(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editingCategory) {
        await api.adminUpdateCategory(editingCategory._id, editingCategory);
        setEditingCategory(null);
      } else {
        await api.adminCreateCategory({
          ...categoryForm,
          plafond_mensuel: Number(categoryForm.plafond_mensuel || 0)
        });
        setCategoryForm({ nom: '', description: '', plafond_mensuel: '' });
      }
      setRefresh((value) => value + 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function removeCategory(category) {
    if (!window.confirm(`Supprimer la catégorie « ${category.nom} » ?`)) return;
    setError('');
    try {
      await api.adminDeleteCategory(category._id);
      setRefresh((value) => value + 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  const pendingUsers = users.filter((user) => user.status === 'pending');

  return (
    <>
      <div className="page-heading admin-page-heading">
        <div>
          <p className="eyebrow">ESPACE SÉCURISÉ</p>
          <h1>Administration</h1>
          <p className="page-subtitle">Gérez les accès clients, les transactions et les catégories.</p>
        </div>
        <span className="admin-access-badge"><span aria-hidden="true">●</span> Accès administrateur</span>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {loading && !overview ? <p className="loading-screen">Chargement du tableau de bord…</p> : (
        <>
          <nav className="admin-tabs" aria-label="Sections d’administration">
            {tabs.map((item) => (
              <button key={item.id} className={`admin-tab ${tab === item.id ? 'active' : ''}`} onClick={() => setTab(item.id)}>
                {item.label}{item.id === 'users' && overview?.users.pending > 0 && <span className="admin-tab-count">{overview.users.pending}</span>}
              </button>
            ))}
          </nav>

          {tab === 'dashboard' && overview && (
            <>
              <section className="admin-metrics">
                <article className="admin-metric"><span className="admin-metric-icon">♙</span><span className="stat-label">Comptes clients</span><strong>{overview.users.total}</strong><small>{overview.users.approved} approuvés</small></article>
                <article className="admin-metric pending-metric"><span className="admin-metric-icon">◷</span><span className="stat-label">À valider</span><strong>{overview.users.pending}</strong><small>Demandes en attente</small></article>
                <article className="admin-metric"><span className="admin-metric-icon">↔</span><span className="stat-label">Transactions</span><strong>{overview.transactions.volume.toLocaleString('fr-FR')}</strong><small>Tous les comptes</small></article>
                <article className="admin-metric balance-metric"><span className="admin-metric-icon">∑</span><span className="stat-label">Solde global</span><strong>{money(overview.transactions.solde)}</strong><small>Revenus moins dépenses</small></article>
              </section>

              <section className="admin-dashboard-grid">
                <article className="panel admin-panel">
                  <div className="panel-heading">
                    <div><p className="eyebrow">VALIDATION</p><h2>Demandes récentes</h2></div>
                    <button className="button button-secondary button-small" onClick={() => { setUserStatus('pending'); setTab('users'); }}>Tout voir</button>
                  </div>
                  <div className="admin-table-wrap">
                    {pendingUsers.length ? pendingUsers.slice(0, 6).map((user) => (
                      <div className="approval-row" key={user.id}>
                        <div className="admin-user-avatar">{user.nom_complet.charAt(0).toUpperCase()}</div>
                        <div className="approval-user"><strong>{user.nom_complet}</strong><small>{user.email}</small></div>
                        <small className="approval-date">{date(user.date_inscription)}</small>
                        <div className="approval-actions">
                          <button className="admin-action approve" onClick={() => changeStatus(user, 'approved')} aria-label={`Accepter ${user.nom_complet}`}>Accepter</button>
                          <button className="admin-action reject" onClick={() => changeStatus(user, 'rejected')} aria-label={`Refuser ${user.nom_complet}`}>Refuser</button>
                        </div>
                      </div>
                    )) : <p className="admin-empty">Aucune demande en attente. Les nouveaux comptes apparaîtront ici.</p>}
                  </div>
                </article>
                <article className="panel admin-security-panel">
                  <div className="security-icon" aria-hidden="true">✓</div>
                  <p className="eyebrow">SÉCURITÉ</p>
                  <h2>Accès protégés</h2>
                  <ul>
                    <li>Les droits admin sont vérifiés par l’API.</li>
                    <li>Les clients restent isolés par compte.</li>
                    <li>Les mots de passe ne sont jamais visibles ici.</li>
                    <li>Un changement d’accès ferme les sessions existantes.</li>
                  </ul>
                </article>
              </section>
            </>
          )}

          {tab === 'users' && (
            <section className="panel admin-panel">
              <div className="admin-section-heading">
                <div><p className="eyebrow">ACCÈS CLIENTS</p><h2>Comptes et demandes</h2></div>
                <div className="admin-filters">
                  <input aria-label="Rechercher un client" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Nom ou e-mail…" />
                  <select aria-label="Filtrer par statut" value={userStatus} onChange={(event) => setUserStatus(event.target.value)}>
                    <option value="">Tous les statuts</option><option value="pending">En attente</option><option value="approved">Approuvés</option><option value="rejected">Refusés</option>
                  </select>
                </div>
              </div>
              <div className="table-scroll">
                <table className="admin-table">
                  <thead><tr><th>Client</th><th>Inscription</th><th>Rôle</th><th>Statut</th><th>Décision</th></tr></thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td><strong>{user.nom_complet}</strong><small>{user.email}</small></td>
                        <td>{date(user.date_inscription)}</td>
                        <td>{user.role === 'admin' ? 'Administrateur' : 'Client'}</td>
                        <td><span className={`account-status ${user.status}`}>{statusLabels[user.status] || statusLabels.approved}</span></td>
                        <td>{user.role === 'admin' ? <span className="admin-locked">Protégé</span> : <div className="approval-actions">
                          {user.status !== 'approved' && <button className="admin-action approve" onClick={() => changeStatus(user, 'approved')}>Accepter</button>}
                          {user.status !== 'rejected' && <button className="admin-action reject" onClick={() => changeStatus(user, 'rejected')}>Refuser</button>}
                        </div>}</td>
                      </tr>
                    ))}
                    {!users.length && <tr><td className="table-message" colSpan="5">Aucun compte ne correspond à cette recherche.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'transactions' && (
            <section className="panel admin-panel">
              <div className="admin-section-heading">
                <div><p className="eyebrow">VUE GLOBALE</p><h2>Transactions des clients</h2></div>
                <div className="admin-transaction-tools">
                  <input className="admin-search" aria-label="Rechercher une transaction" value={transactionSearch} onChange={(event) => setTransactionSearch(event.target.value)} placeholder="Titre ou tag…" />
                  <button className="button button-primary button-small" disabled={!clients.length || !categories.length} onClick={() => openTransaction()}>＋ Ajouter</button>
                </div>
              </div>
              <div className="table-scroll">
                <table className="admin-table transaction-admin-table">
                  <thead><tr><th>Date</th><th>Client</th><th>Transaction</th><th>Catégorie</th><th>Type</th><th>Montant</th><th>Action</th></tr></thead>
                  <tbody>
                    {transactions.map((transaction) => (
                      <tr key={transaction._id}>
                        <td>{date(transaction.date_transaction)}</td>
                        <td><strong>{transaction.user_id?.nom_complet || 'Compte supprimé'}</strong><small>{transaction.user_id?.email || '—'}</small></td>
                        <td>{transaction.titre}</td>
                        <td>{transaction.categorie_id?.nom || '—'}</td>
                        <td><span className={`type-badge ${transaction.type === 'Revenu' ? 'income' : 'expense'}`}>{transaction.type}</span></td>
                        <td className={`amount-cell ${transaction.type === 'Revenu' ? 'positive' : 'negative'}`}>{money(transaction.montant_total)}</td>
                        <td><div className="approval-actions">
                          <button className="admin-action" onClick={() => openTransaction(transaction)}>Modifier</button>
                          <button className="admin-action reject" onClick={() => removeTransaction(transaction)}>Supprimer</button>
                        </div></td>
                      </tr>
                    ))}
                    {!transactions.length && <tr><td className="table-message" colSpan="7">Aucune transaction trouvée.</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="admin-table-note">Affichage des 20 transactions les plus récentes. La recherche utilise l’index textuel MongoDB.</p>
            </section>
          )}

          {tab === 'categories' && (
            <section className="admin-category-layout">
              <article className="panel admin-panel">
                <div className="admin-section-heading">
                  <div><p className="eyebrow">CLASSIFICATION</p><h2>Catégories disponibles</h2></div>
                  <span className="panel-count">{categories.length} catégories</span>
                </div>
                <div className="admin-category-list">
                  {categories.map((category) => editingCategory?._id === category._id ? (
                    <form className="category-edit-row" key={category._id} onSubmit={saveCategory}>
                      <input aria-label="Nom de catégorie" required maxLength="80" value={editingCategory.nom} onChange={(event) => setEditingCategory({ ...editingCategory, nom: event.target.value })} />
                      <input aria-label="Description" maxLength="300" value={editingCategory.description || ''} onChange={(event) => setEditingCategory({ ...editingCategory, description: event.target.value })} />
                      <input aria-label="Plafond mensuel" type="number" min="0" step="0.01" value={editingCategory.plafond_mensuel} onChange={(event) => setEditingCategory({ ...editingCategory, plafond_mensuel: event.target.value })} />
                      <button className="admin-action approve" disabled={saving}>Enregistrer</button>
                      <button className="admin-action reject" type="button" onClick={() => setEditingCategory(null)}>Annuler</button>
                    </form>
                  ) : (
                    <div className="admin-category-row" key={category._id}>
                      <span className="category-dot" />
                      <div><strong>{category.nom}</strong><small>{category.description || 'Aucune description'}</small></div>
                      <span className="category-budget">{money(category.plafond_mensuel || 0)}<small> plafond / mois</small></span>
                      <div className="approval-actions">
                        <button className="admin-action" onClick={() => setEditingCategory({ ...category })}>Modifier</button>
                        <button className="admin-action reject" onClick={() => removeCategory(category)}>Supprimer</button>
                      </div>
                    </div>
                  ))}
                  {!categories.length && <p className="admin-empty">Aucune catégorie n’est configurée.</p>}
                </div>
              </article>
              <article className="panel admin-panel category-create-panel">
                <p className="eyebrow">NOUVELLE CATÉGORIE</p>
                <h2>Ajouter une catégorie</h2>
                <form className="admin-category-form" onSubmit={saveCategory}>
                  <label className="form-field">Nom<input required maxLength="80" value={categoryForm.nom} onChange={(event) => setCategoryForm({ ...categoryForm, nom: event.target.value })} placeholder="Ex. Voyage" /></label>
                  <label className="form-field">Description<input maxLength="300" value={categoryForm.description} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} placeholder="À quoi sert cette catégorie ?" /></label>
                  <label className="form-field">Plafond mensuel (TND)<input type="number" min="0" step="0.01" value={categoryForm.plafond_mensuel} onChange={(event) => setCategoryForm({ ...categoryForm, plafond_mensuel: event.target.value })} placeholder="0" /></label>
                  <button className="button button-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Ajouter la catégorie'}</button>
                </form>
              </article>
            </section>
          )}
        </>
      )}
      {transactionDraft && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setTransactionDraft(null)}>
          <section className="modal-card admin-transaction-modal" role="dialog" aria-modal="true" aria-labelledby="admin-transaction-title">
            <div className="modal-heading">
              <div><p className="eyebrow">GESTION ADMINISTRATEUR</p><h2 id="admin-transaction-title">{transactionDraft._id ? 'Modifier la transaction' : 'Créer une transaction'}</h2></div>
              <button className="icon-button" onClick={() => setTransactionDraft(null)} aria-label="Fermer">×</button>
            </div>
            <form className="admin-transaction-form" onSubmit={saveTransaction}>
              {!transactionDraft._id && <label className="form-field">Compte client
                <select required value={transactionDraft.user_id} onChange={(event) => setTransactionDraft({ ...transactionDraft, user_id: event.target.value })}>
                  <option value="">Choisir un client</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.nom_complet} — {client.email}</option>)}
                </select>
              </label>}
              <label className="form-field">Titre<input required maxLength="160" value={transactionDraft.titre} onChange={(event) => setTransactionDraft({ ...transactionDraft, titre: event.target.value })} /></label>
              <div className="admin-form-grid">
                <label className="form-field">Type<select value={transactionDraft.type} onChange={(event) => setTransactionDraft({ ...transactionDraft, type: event.target.value })}><option>Dépense</option><option>Revenu</option></select></label>
                <label className="form-field">Catégorie<select required value={transactionDraft.categorie_id} onChange={(event) => setTransactionDraft({ ...transactionDraft, categorie_id: event.target.value })}><option value="">Choisir</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.nom}</option>)}</select></label>
                <label className="form-field">Date<input required type="datetime-local" value={transactionDraft.date_transaction} onChange={(event) => setTransactionDraft({ ...transactionDraft, date_transaction: event.target.value })} /></label>
                <label className="form-field">Mode de paiement<input maxLength="60" value={transactionDraft.mode_paiement || ''} onChange={(event) => setTransactionDraft({ ...transactionDraft, mode_paiement: event.target.value })} /></label>
                <label className="form-field">Montant (TND)<input required type="number" min="0" step="0.01" value={transactionDraft.montant_total} disabled={Boolean(transactionDraft.details_articles?.length)} onChange={(event) => setTransactionDraft({ ...transactionDraft, montant_total: event.target.value })} /></label>
                <label className="form-field">Tags<input value={transactionDraft.tags} onChange={(event) => setTransactionDraft({ ...transactionDraft, tags: event.target.value })} placeholder="séparés par des virgules" /></label>
              </div>
              {transactionDraft.details_articles?.length > 0 && <p className="admin-form-note">Le montant est recalculé depuis les {transactionDraft.details_articles.length} article(s) déjà enregistrés.</p>}
              <div className="form-actions"><button type="button" className="button button-secondary" onClick={() => setTransactionDraft(null)}>Annuler</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button></div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
