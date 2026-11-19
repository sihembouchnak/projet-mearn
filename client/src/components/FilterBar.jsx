export default function FilterBar({ search, setSearch, type, setType, category, setCategory, categories }) {
  return (
    <section className="filter-bar" aria-label="Recherche et filtres">
      <label className="search-field">
        <span className="search-icon" aria-hidden="true">⌕</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher une transaction ou un tag…"
          aria-label="Rechercher par titre ou tag"
        />
        {search && <button className="clear-search" onClick={() => setSearch('')} aria-label="Effacer la recherche">×</button>}
      </label>
      <label className="filter-select">
        <span className="sr-only">Type de transaction</span>
        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">Tous les types</option>
          <option value="Dépense">Dépense</option>
          <option value="Revenu">Revenu</option>
        </select>
      </label>
      <label className="filter-select">
        <span className="sr-only">Catégorie</span>
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">Toutes les catégories</option>
          {categories.map((item) => <option key={item._id} value={item._id}>{item.nom}</option>)}
        </select>
      </label>
    </section>
  );
}
