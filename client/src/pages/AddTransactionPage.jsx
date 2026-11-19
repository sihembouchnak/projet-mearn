import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, getErrorMessage, money } from '../services/api.js';

const emptyArticle = () => ({ nom: '', quantite: 1, prix_unitaire: 0 });
const initialForm = {
  titre: '', type: 'Dépense', categorie_id: '', date_transaction: new Date().toISOString().slice(0, 16),
  mode_paiement: 'Carte Bancaire', tags: '', montant_total: '', details_articles: []
};

function localDateValue(value) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function AddTransactionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([api.categories(), id ? api.transaction(id) : Promise.resolve(null)])
      .then(([categoryList, transaction]) => {
        if (!active) return;
        setCategories(categoryList);
        if (transaction) {
          setForm({
            titre: transaction.titre,
            type: transaction.type,
            categorie_id: transaction.categorie_id?._id || transaction.categorie_id,
            date_transaction: localDateValue(transaction.date_transaction),
            mode_paiement: transaction.mode_paiement || 'Autre',
            tags: (transaction.tags || []).join(', '),
            montant_total: transaction.montant_total,
            details_articles: (transaction.details_articles || []).map(({ nom, quantite, prix_unitaire }) => ({ nom, quantite, prix_unitaire }))
          });
        }
      })
      .catch((err) => { if (active) setError(getErrorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const calculatedTotal = useMemo(
    () => Number(form.details_articles.reduce((sum, item) => sum + (Number(item.quantite) || 0) * (Number(item.prix_unitaire) || 0), 0).toFixed(2)),
    [form.details_articles]
  );

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateArticle(index, field, value) {
    setForm((current) => ({
      ...current,
      details_articles: current.details_articles.map((article, currentIndex) => currentIndex === index
        ? { ...article, [field]: field === 'nom' ? value : Number(value) }
        : article)
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    const payload = {
      titre: form.titre.trim(),
      type: form.type,
      categorie_id: form.categorie_id,
      date_transaction: new Date(form.date_transaction).toISOString(),
      mode_paiement: form.mode_paiement,
      tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      details_articles: form.details_articles.filter((article) => article.nom.trim()),
      montant_total: form.details_articles.length ? calculatedTotal : Number(form.montant_total)
    };
    try {
      if (id) await api.updateTransaction(id, payload);
      else await api.createTransaction(payload);
      navigate('/transactions');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="loading-screen">Chargement de la transaction…</p>;

  return (
    <div className="form-page">
      <div className="page-heading">
        <div><p className="eyebrow">GESTION DES OPÉRATIONS</p><h1>{id ? 'Modifier l’opération' : 'Nouvelle opération'}</h1><p className="page-subtitle">Renseignez les informations de votre transaction.</p></div>
        <Link to="/transactions" className="button button-secondary">← Retour</Link>
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <form className="form-card" onSubmit={submit}>
        <div className="form-section">
          <h2>Informations générales</h2>
          <div className="form-grid">
            <label className="form-field field-wide">Titre de l’opération
              <input required maxLength="160" value={form.titre} onChange={(event) => update('titre', event.target.value)} placeholder="Ex. Courses hebdomadaires" />
            </label>
            <label className="form-field">Type
              <select value={form.type} onChange={(event) => update('type', event.target.value)}>
                <option>Dépense</option><option>Revenu</option>
              </select>
            </label>
            <label className="form-field">Catégorie
              <select required value={form.categorie_id} onChange={(event) => update('categorie_id', event.target.value)}>
                <option value="">Choisir une catégorie</option>
                {categories.map((category) => <option key={category._id} value={category._id}>{category.nom}</option>)}
              </select>
            </label>
            <label className="form-field">Date et heure
              <input required type="datetime-local" value={form.date_transaction} onChange={(event) => update('date_transaction', event.target.value)} />
            </label>
            <label className="form-field">Mode de paiement
              <select value={form.mode_paiement} onChange={(event) => update('mode_paiement', event.target.value)}>
                <option>Carte Bancaire</option><option>Espèces</option><option>Virement</option><option>Chèque</option><option>Autre</option>
              </select>
            </label>
            <label className="form-field field-wide">Tags <span className="field-hint">Séparez les mots-clés par une virgule.</span>
              <input value={form.tags} onChange={(event) => update('tags', event.target.value)} placeholder="courses, maison, urgent" />
            </label>
          </div>
        </div>

        <div className="form-section articles-section">
          <div className="section-heading-row"><div><h2>Articles de l’opération</h2><p>Le montant est calculé automatiquement à partir des lignes ajoutées.</p></div>
            <button type="button" className="button button-secondary button-small" onClick={() => update('details_articles', [...form.details_articles, emptyArticle()])}>＋ Ajouter un article</button>
          </div>
          {form.details_articles.length > 0 && <div className="article-form-labels"><span>Nom de l’article</span><span>Quantité</span><span>Prix unitaire</span><span /></div>}
          {form.details_articles.map((article, index) => (
            <div className="article-form-row" key={index}>
              <input aria-label="Nom de l’article" value={article.nom} onChange={(event) => updateArticle(index, 'nom', event.target.value)} placeholder="Ex. Lait 1L" />
              <input aria-label="Quantité" type="number" min="0.01" step="0.01" value={article.quantite} onChange={(event) => updateArticle(index, 'quantite', event.target.value)} />
              <input aria-label="Prix unitaire" type="number" min="0" step="0.01" value={article.prix_unitaire} onChange={(event) => updateArticle(index, 'prix_unitaire', event.target.value)} />
              <button type="button" className="remove-article" aria-label="Supprimer l’article" onClick={() => update('details_articles', form.details_articles.filter((_, itemIndex) => itemIndex !== index))}>×</button>
            </div>
          ))}
          <div className="total-box">
            <span>Montant total</span>
            {form.details_articles.length
              ? <strong>{money(calculatedTotal)}</strong>
              : <input required aria-label="Montant total" type="number" min="0" step="0.01" value={form.montant_total} onChange={(event) => update('montant_total', event.target.value)} placeholder="0,00" />}
          </div>
        </div>
        <div className="form-actions"><Link className="button button-secondary" to="/transactions">Annuler</Link><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : id ? 'Enregistrer les modifications' : 'Créer la transaction'}</button></div>
      </form>
    </div>
  );
}
