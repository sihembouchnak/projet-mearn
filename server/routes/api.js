import { Router } from 'express';
import mongoose from 'mongoose';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';

const router = Router();
const PAGE_SIZE_MAX = 100;
const transactionPopulate = [
  { path: 'categorie_id', select: 'nom plafond_mensuel' },
  { path: 'user_id', select: 'nom_complet devise' }
];

function parseObjectId(value) {
  return mongoose.isValidObjectId(value);
}

function parsePagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(PAGE_SIZE_MAX, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

function transactionFilters(query) {
  const filter = {};
  if (query.type) {
    if (!['Dépense', 'Revenu'].includes(query.type)) {
      const error = new Error('Type de transaction invalide.');
      error.status = 400;
      throw error;
    }
    filter.type = query.type;
  }
  if (query.category) {
    if (!parseObjectId(query.category)) {
      const error = new Error('Identifiant de catégorie invalide.');
      error.status = 400;
      throw error;
    }
    filter.categorie_id = query.category;
  }
  return filter;
}

function validateTransactionInput(body, { partial = false } = {}) {
  const error = (message) => Object.assign(new Error(message), { status: 400 });
  if (!partial || body.titre !== undefined) {
    if (typeof body.titre !== 'string' || !body.titre.trim()) throw error('Le titre est obligatoire.');
  }
  if (!partial || body.type !== undefined) {
    if (!['Dépense', 'Revenu'].includes(body.type)) throw error('Le type doit être Dépense ou Revenu.');
  }
  if (!partial || body.categorie_id !== undefined) {
    if (!parseObjectId(body.categorie_id)) throw error('Une catégorie valide est obligatoire.');
  }
  if (body.montant_total !== undefined && (!Number.isFinite(Number(body.montant_total)) || Number(body.montant_total) < 0)) {
    throw error('Le montant doit être un nombre positif ou nul.');
  }
  if (body.details_articles !== undefined && !Array.isArray(body.details_articles)) {
    throw error('Les détails des articles doivent être une liste.');
  }
  if (body.tags !== undefined && !Array.isArray(body.tags)) {
    throw error('Les tags doivent être une liste.');
  }
}

function pickTransactionFields(body, userId) {
  const data = {};
  for (const field of ['titre', 'type', 'mode_paiement', 'date_transaction', 'categorie_id']) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  if (body.montant_total !== undefined) data.montant_total = Number(body.montant_total);
  if (body.tags !== undefined) data.tags = body.tags.map((tag) => String(tag).trim()).filter(Boolean);
  if (body.details_articles !== undefined) {
    data.details_articles = body.details_articles.map((article) => ({
      nom: String(article.nom ?? '').trim(),
      quantite: Number(article.quantite),
      prix_unitaire: Number(article.prix_unitaire)
    }));
    if (data.details_articles.length) {
      data.montant_total = Number(data.details_articles
        .reduce((sum, article) => sum + article.quantite * article.prix_unitaire, 0)
        .toFixed(2));
    }
  }
  if (userId) data.user_id = userId;
  return data;
}

async function listTransactions(req, res, next, searchText = '') {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { user_id: req.userId, ...transactionFilters(req.query) };
    if (searchText) filter.$text = { $search: searchText };

    const query = Transaction.find(filter)
      .populate(transactionPopulate)
      .sort(searchText ? { score: { $meta: 'textScore' }, date_transaction: -1 } : { date_transaction: -1 })
      .skip(skip)
      .limit(limit);
    if (searchText) query.select({ score: { $meta: 'textScore' } });

    const [transactions, total] = await Promise.all([
      query,
      Transaction.countDocuments(filter)
    ]);
    res.json({
      data: transactions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
}

// Keep this route before /:id so "search" is not parsed as an identifier.
router.get('/transactions/search', (req, res, next) => {
  const searchText = String(req.query.q ?? '').trim();
  if (!searchText) return listTransactions(req, res, next);
  return listTransactions(req, res, next, searchText);
});

router.get('/transactions', (req, res, next) => listTransactions(req, res, next));

router.get('/transactions/:id', async (req, res, next) => {
  try {
    if (!parseObjectId(req.params.id)) return res.status(400).json({ message: 'Identifiant invalide.' });
    const transaction = await Transaction.findOne({ _id: req.params.id, user_id: req.userId }).populate(transactionPopulate);
    if (!transaction) return res.status(404).json({ message: 'Transaction introuvable.' });
    res.json(transaction);
  } catch (error) {
    next(error);
  }
});

router.post('/transactions', async (req, res, next) => {
  try {
    const body = req.body ?? {};
    validateTransactionInput(body);
    const categoryExists = await Category.exists({ _id: body.categorie_id });
    if (!categoryExists) return res.status(400).json({ message: 'La catégorie sélectionnée est introuvable.' });
    const transaction = await Transaction.create(pickTransactionFields(body, req.userId));
    await transaction.populate(transactionPopulate);
    res.status(201).json(transaction);
  } catch (error) {
    next(error);
  }
});

router.put('/transactions/:id', async (req, res, next) => {
  try {
    const body = req.body ?? {};
    if (!parseObjectId(req.params.id)) return res.status(400).json({ message: 'Identifiant invalide.' });
    validateTransactionInput(body, { partial: true });
    if (!Object.keys(body).some((field) => ['titre', 'type', 'categorie_id', 'montant_total', 'date_transaction', 'mode_paiement', 'tags', 'details_articles'].includes(field))) {
      return res.status(400).json({ message: 'Indiquez au moins un champ à modifier.' });
    }
    if (body.categorie_id) {
      const categoryExists = await Category.exists({ _id: body.categorie_id });
      if (!categoryExists) return res.status(400).json({ message: 'La catégorie sélectionnée est introuvable.' });
    }
    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, user_id: req.userId },
      { $set: pickTransactionFields(body) },
      { new: true, runValidators: true }
    ).populate(transactionPopulate);
    if (!transaction) return res.status(404).json({ message: 'Transaction introuvable.' });
    res.json(transaction);
  } catch (error) {
    next(error);
  }
});

router.delete('/transactions/:id', async (req, res, next) => {
  try {
    if (!parseObjectId(req.params.id)) return res.status(400).json({ message: 'Identifiant invalide.' });
    const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, user_id: req.userId });
    if (!transaction) return res.status(404).json({ message: 'Transaction introuvable.' });
    res.json({ message: 'Transaction supprimée.' });
  } catch (error) {
    next(error);
  }
});

router.get('/categories', async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ nom: 1 }).lean();
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

router.get('/stats/by-category', async (req, res, next) => {
  try {
    const match = { type: 'Dépense', user_id: new mongoose.Types.ObjectId(req.userId) };
    const data = await Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$categorie_id',
          operations: { $sum: 1 },
          montant_total: { $sum: '$montant_total' },
          depense_moyenne: { $avg: '$montant_total' }
        }
      },
      { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'categorie' } },
      { $unwind: { path: '$categorie', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          categorie_id: '$_id',
          categorie: { $ifNull: ['$categorie.nom', 'Catégorie supprimée'] },
          operations: 1,
          montant_total: { $round: ['$montant_total', 2] },
          depense_moyenne: { $round: ['$depense_moyenne', 2] }
        }
      },
      { $sort: { montant_total: -1 } }
    ]);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/stats/monthly', async (req, res, next) => {
  try {
    const match = { user_id: new mongoose.Types.ObjectId(req.userId) };
    const [result = { months: [], summary: [] }] = await Transaction.aggregate([
      { $match: match },
      {
        $facet: {
          months: [
            {
              $group: {
                _id: { annee: { $year: '$date_transaction' }, mois: { $month: '$date_transaction' } },
                revenus: { $sum: { $cond: [{ $eq: ['$type', 'Revenu'] }, '$montant_total', 0] } },
                depenses: { $sum: { $cond: [{ $eq: ['$type', 'Dépense'] }, '$montant_total', 0] } },
                volume: { $sum: 1 }
              }
            },
            { $sort: { '_id.annee': 1, '_id.mois': 1 } },
            {
              $project: {
                _id: 0,
                annee: '$_id.annee',
                mois: '$_id.mois',
                revenus: { $round: ['$revenus', 2] },
                depenses: { $round: ['$depenses', 2] },
                volume: 1
              }
            }
          ],
          summary: [
            {
              $group: {
                _id: null,
                revenus: { $sum: { $cond: [{ $eq: ['$type', 'Revenu'] }, '$montant_total', 0] } },
                depenses: { $sum: { $cond: [{ $eq: ['$type', 'Dépense'] }, '$montant_total', 0] } },
                volume: { $sum: 1 }
              }
            },
            { $project: { _id: 0, revenus: { $round: ['$revenus', 2] }, depenses: { $round: ['$depenses', 2] }, volume: 1 } }
          ]
        }
      }
    ]);
    const summary = result.summary[0] ?? { revenus: 0, depenses: 0, volume: 0 };
    res.json({
      summary: { ...summary, solde: Number((summary.revenus - summary.depenses).toFixed(2)) },
      months: result.months
    });
  } catch (error) {
    next(error);
  }
});

export default router;
