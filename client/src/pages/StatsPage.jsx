import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, getErrorMessage, money } from '../services/api.js';

const monthName = (month) => new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date(2026, month - 1, 1));

export default function StatsPage() {
  const [categoryStats, setCategoryStats] = useState([]);
  const [monthlyStats, setMonthlyStats] = useState({ summary: { revenus: 0, depenses: 0, solde: 0, volume: 0 }, months: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.categoryStats(), api.monthlyStats()])
      .then(([byCategory, monthly]) => {
        setCategoryStats(byCategory);
        setMonthlyStats(monthly);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const summary = monthlyStats.summary;
  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">VUE D’ENSEMBLE</p><h1>Vos statistiques</h1><p className="page-subtitle">Comprenez où va votre argent et suivez votre évolution.</p></div>
        <span className="period-pill">Depuis le début</span>
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {loading ? <p className="loading-screen">Calcul des statistiques…</p> : (
        <>
          <section className="stat-cards">
            <article className="stat-card"><span className="stat-label">Total des revenus</span><strong className="stat-value positive">{money(summary.revenus)}</strong><span className="stat-foot">Toutes les opérations enregistrées</span><span className="stat-icon income-icon">↗</span></article>
            <article className="stat-card"><span className="stat-label">Total des dépenses</span><strong className="stat-value">{money(summary.depenses)}</strong><span className="stat-foot">Toutes les opérations enregistrées</span><span className="stat-icon expense-icon">↘</span></article>
            <article className="stat-card"><span className="stat-label">Solde net</span><strong className={`stat-value ${summary.solde >= 0 ? 'positive' : 'negative'}`}>{money(summary.solde)}</strong><span className="stat-foot">{summary.volume.toLocaleString('fr-FR')} opérations au total</span><span className="stat-icon balance-icon">∑</span></article>
          </section>
          <section className="analytics-grid">
            <article className="panel chart-panel">
              <div className="panel-heading"><div><p className="eyebrow">RÉPARTITION</p><h2>Dépenses par catégorie</h2></div><span className="panel-count">{categoryStats.length} catégories</span></div>
              {categoryStats.length ? <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={categoryStats} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0eb" />
                    <XAxis dataKey="categorie" axisLine={false} tickLine={false} tick={{ fill: '#788078', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#788078', fontSize: 12 }} />
                    <Tooltip formatter={(value) => money(value)} cursor={{ fill: '#f5f7f3' }} />
                    <Bar dataKey="montant_total" name="Dépenses" fill="#4a8061" radius={[6, 6, 0, 0]} maxBarSize={56} />
                  </BarChart>
                </ResponsiveContainer>
              </div> : <p className="empty-note">Aucune dépense à analyser pour le moment.</p>}
              <div className="table-scroll"><table className="stats-table"><thead><tr><th>Catégorie</th><th>Opérations</th><th>Montant total</th><th>Moyenne</th></tr></thead>
                <tbody>{categoryStats.map((row) => <tr key={row.categorie_id}><td><span className="category-cell"><span className="category-dot" />{row.categorie}</span></td><td>{row.operations}</td><td className="amount-cell">{money(row.montant_total)}</td><td>{money(row.depense_moyenne)}</td></tr>)}
                  {!categoryStats.length && <tr><td colSpan="4" className="table-message">Aucune donnée disponible.</td></tr>}</tbody>
              </table></div>
            </article>
            <article className="panel monthly-panel">
              <div className="panel-heading"><div><p className="eyebrow">TENDANCE</p><h2>Évolution mensuelle</h2></div><span className="panel-count">{monthlyStats.months.length} mois</span></div>
              <div className="table-scroll"><table className="stats-table monthly-table"><thead><tr><th>Période</th><th>Revenus</th><th>Dépenses</th><th>Volume</th></tr></thead>
                <tbody>{[...monthlyStats.months].reverse().map((row) => <tr key={`${row.annee}-${row.mois}`}><td><strong className="period-name">{monthName(row.mois)}</strong><small className="period-year">{row.annee}</small></td><td className="positive">{money(row.revenus)}</td><td>{money(row.depenses)}</td><td>{row.volume}</td></tr>)}
                  {!monthlyStats.months.length && <tr><td colSpan="4" className="table-message">Aucune donnée disponible.</td></tr>}</tbody>
              </table></div>
            </article>
          </section>
        </>
      )}
    </>
  );
}
