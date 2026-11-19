import { Router } from 'express';
import Budget from '../models/Budget.js';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { parseObjectId, parsePagination, pickTransactionFields, validateTransactionInput } from './api.js';

const router = Router();
const transactionPopulate = [
  { path: 'categorie_id', select: 'nom plafond_mensuel' },
  { path: 'user_id', select: 'nom_complet email' }
];

function publicUser(user) {
  return {
    id: user._id,
    nom_complet: user.nom_complet,
    email: user.email,
    role: user.role ?? 'client',
    status: user.status ?? 'approved',
    date_inscription: user.date_inscription
  };
}

function validateCategoryInput(body, { partial = false } = {}) {
  const error = (message) => Object.assign(new Error(message), { status: 400 });
  const data = {};
  if (!partial || body.nom !== undefined) {
    if (typeof body.nom !== 'string' || !body.nom.trim() || body.nom.trim().length > 80) {
      throw error('Le nom de la categorie doit contenir entre 1 et 80 caracteres.');
    }
    data.nom = body.nom.trim();
  }
  if (body.description !== undefined) {
    if (typeof body.description !== 'string' || body.description.length > 300) {
      throw error('La description ne peut pas depasser 300 caracteres.');
    }
    data.description = body.description.trim();
  }
  if (body.plafond_mensuel !== undefined) {
    const plafond = Number(body.plafond_mensuel);
    if (!Number.isFinite(plafond) || plafond < 0) {
      throw error('Le plafond mensuel doit etre un nombre positif ou nul.');
    }
    data.plafond_mensuel = plafond;
  }
  return data;
}

router.get('/overview', async (req, res, next) => {
  try {
    const [usersByStatus, [transactions = { volume: 0, revenus: 0, depenses: 0 }]] = await Promise.all([
      User.aggregate([
        { $group: { _id: { $ifNull: ['$status', 'approved'] }, count: { $sum: 1 } } }
      ]),
      Transaction.aggregate([
        {
          $group: {
            _id: null,
            volume: { $sum: 1 },
            revenus: { $sum: { $cond: [{ $eq: ['$type', 'Revenu'] }, '$montant_total', 0] } },
            depenses: { $sum: { $cond: [{ $eq: ['$type', 'Dépense'] }, '$montant_total', 0] } }
          }
        },
        { $project: { _id: 0, volume: 1, revenus: { $round: ['$revenus', 2] }, depenses: { $round: ['$depenses', 2] } } }
      ])
    ]);
    const users = { total: 0, pending: 0, approved: 0, rejected: 0 };
    for (const item of usersByStatus) {
      users[item._id] = item.count;
      users.total += item.count;
    }
    res.json({
      users,
      transactions: {
        ...transactions,
        solde: Number((transactions.revenus - transactions.depenses).toFixed(2))
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    if (req.query.status) {
      if (!['pending', 'approved', 'rejected'].includes(req.query.status)) {
        return res.status(400).json({ message: 'Statut de compte invalide.' });
      }
      filter.status = req.query.status;
    }
    const search = String(req.query.q ?? '').trim().slice(0, 100);
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { nom_complet: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } }
      ];
    }
    const [users, total] = await Promise.all([
      User.find(filter).select('nom_complet email role status date_inscription').sort({ date_inscription: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter)
    ]);
    const data = users.map((user) => publicUser(user));
    res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
});

router.patch('/users/:id/status', async (req, res, next) => {
  try {
    if (!parseObjectId(req.params.id)) return res.status(400).json({ message: 'Identifiant invalide.' });
    const { status } = req.body ?? {};
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Le statut doit etre approved ou rejected.' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Compte introuvable.' });
    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Le statut d’un compte administrateur ne peut pas etre modifie ici.' });
    }
    user.status = status;
    user.session_version = (user.session_version ?? 0) + 1;
    await user.save();
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.get('/transactions', async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    if (req.query.type) {
      if (!['Dépense', 'Revenu'].includes(req.query.type)) {
        return res.status(400).json({ message: 'Type de transaction invalide.' });
      }
      filter.type = req.query.type;
    }
    if (req.query.userId) {
      if (!parseObjectId(req.query.userId)) return res.status(400).json({ message: 'Identifiant de compte invalide.' });
      filter.user_id = req.query.userId;
    }
    const search = String(req.query.q ?? '').trim();
    if (search) filter.$text = { $search: search };
    const [transactions, total] = await Promise.all([
      Transaction.find(filter).populate(transactionPopulate)
        .sort(search ? { score: { $meta: 'textScore' }, date_transaction: -1 } : { date_transaction: -1 })
        .skip(skip).limit(limit),
      Transaction.countDocuments(filter)
    ]);
    res.json({ data: transactions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
});

router.post('/transactions', async (req, res, next) => {
  try {
    const body = req.body ?? {};
    validateTransactionInput(body);
    if (!parseObjectId(body.user_id)) return res.status(400).json({ message: 'Un compte client valide est obligatoire.' });
    const [user, category] = await Promise.all([
      User.findOne({ _id: body.user_id, role: 'client', status: 'approved' }),
      Category.exists({ _id: body.categorie_id })
    ]);
    if (!user) return res.status(400).json({ message: 'Le compte client est introuvable ou inactif.' });
    if (!category) return res.status(400).json({ message: 'La categorie selectionnee est introuvable.' });
    const transaction = await Transaction.create(pickTransactionFields(body, user._id));
    await transaction.populate(transactionPopulate);
    res.status(201).json(transaction);
  } catch (error) {
    next(error);
  }
});

router.put('/transactions/:id', async (req, res, next) => {
  try {
    if (!parseObjectId(req.params.id)) return res.status(400).json({ message: 'Identifiant invalide.' });
    const body = req.body ?? {};
    validateTransactionInput(body, { partial: true });
    if (!Object.keys(body).some((field) => ['titre', 'type', 'categorie_id', 'montant_total', 'date_transaction', 'mode_paiement', 'tags', 'details_articles'].includes(field))) {
      return res.status(400).json({ message: 'Indiquez au moins un champ a modifier.' });
    }
    if (body.categorie_id && !await Category.exists({ _id: body.categorie_id })) {
      return res.status(400).json({ message: 'La categorie selectionnee est introuvable.' });
    }
    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
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
    const transaction = await Transaction.findByIdAndDelete(req.params.id);
    if (!transaction) return res.status(404).json({ message: 'Transaction introuvable.' });
    res.json({ message: 'Transaction supprimee.' });
  } catch (error) {
    next(error);
  }
});

router.get('/categories', async (req, res, next) => {
  try {
    res.json(await Category.find().sort({ nom: 1 }).lean());
  } catch (error) {
    next(error);
  }
});

router.post('/categories', async (req, res, next) => {
  try {
    res.status(201).json(await Category.create(validateCategoryInput(req.body ?? {})));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Une categorie porte deja ce nom.' });
    next(error);
  }
});

router.put('/categories/:id', async (req, res, next) => {
  try {
    if (!parseObjectId(req.params.id)) return res.status(400).json({ message: 'Identifiant invalide.' });
    const body = req.body ?? {};
    const data = validateCategoryInput(body, { partial: true });
    if (!Object.keys(data).length) return res.status(400).json({ message: 'Indiquez au moins un champ a modifier.' });
    const category = await Category.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true });
    if (!category) return res.status(404).json({ message: 'Categorie introuvable.' });
    res.json(category);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Une categorie porte deja ce nom.' });
    next(error);
  }
});

router.delete('/categories/:id', async (req, res, next) => {
  try {
    if (!parseObjectId(req.params.id)) return res.status(400).json({ message: 'Identifiant invalide.' });
    const [transaction, budget] = await Promise.all([
      Transaction.exists({ categorie_id: req.params.id }),
      Budget.exists({ categorie_id: req.params.id })
    ]);
    if (transaction || budget) {
      return res.status(409).json({ message: 'Cette categorie est utilisee par des transactions ou des budgets et ne peut pas etre supprimee.' });
    }
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ message: 'Categorie introuvable.' });
    res.json({ message: 'Categorie supprimee.' });
  } catch (error) {
    next(error);
  }
});

export default router;
