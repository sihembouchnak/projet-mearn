import { date, money } from '../services/api.js';

export default function TransactionModal({ transaction, onClose }) {
  if (!transaction) return null;
  const category = transaction.categorie_id?.nom || 'Sans catégorie';

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">DÉTAIL DE L’OPÉRATION</p>
            <h2 id="modal-title">{transaction.titre}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <div className="detail-meta">
          <span>{date(transaction.date_transaction)}</span><span>{category}</span>
          <strong className={transaction.type === 'Revenu' ? 'positive' : 'negative'}>
            {transaction.type === 'Revenu' ? '+' : '−'} {money(transaction.montant_total)}
          </strong>
        </div>
        <h3 className="section-title">Articles inclus</h3>
        {transaction.details_articles?.length ? (
          <div className="article-list">
            {transaction.details_articles.map((article) => (
              <div className="article-row" key={article._id || `${article.nom}-${article.prix_unitaire}`}>
                <span><strong>{article.nom}</strong><small>{article.quantite} × {money(article.prix_unitaire)}</small></span>
                <strong>{money(article.quantite * article.prix_unitaire)}</strong>
              </div>
            ))}
          </div>
        ) : <p className="empty-note">Aucun article détaillé pour cette transaction.</p>}
        {!!transaction.tags?.length && <div className="tag-row modal-tags">{transaction.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>}
        <button className="button button-secondary modal-close" onClick={onClose}>Fermer</button>
      </section>
    </div>
  );
}
