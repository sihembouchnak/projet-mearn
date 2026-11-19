import './config/env.js';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import Budget from './models/Budget.js';
import Category from './models/Category.js';
import Transaction from './models/Transaction.js';
import User from './models/User.js';

const categoriesToSeed = [
  { nom: 'Alimentation', description: 'Courses et repas', plafond_mensuel: 800 },
  { nom: 'Transport', description: 'Déplacements et carburant', plafond_mensuel: 400 },
  { nom: 'Logement', description: 'Loyer, charges et entretien', plafond_mensuel: 1500 },
  { nom: 'Santé', description: 'Soins et pharmacie', plafond_mensuel: 300 },
  { nom: 'Salaire', description: 'Revenus professionnels', plafond_mensuel: 0 },
  { nom: 'Loisirs', description: 'Sorties et activités', plafond_mensuel: 350 },
  { nom: 'Éducation', description: 'Formation et fournitures', plafond_mensuel: 250 }
];
const transactionCount = 10_500;
const roundMoney = (value) => Number(value.toFixed(2));

function randomSource(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017', {
    dbName: process.env.MONGODB_DB || 'projet3'
  });

  const demoUserUpdate = {
    $set: { nom_complet: 'Utilisateur Démo', devise: 'TND', role: 'client', status: 'approved' },
    $setOnInsert: { date_inscription: new Date() }
  };
  if (process.env.DEMO_PASSWORD) {
    if (Buffer.byteLength(process.env.DEMO_PASSWORD, 'utf8') < 8 || Buffer.byteLength(process.env.DEMO_PASSWORD, 'utf8') > 72) {
      throw new Error('DEMO_PASSWORD doit contenir entre 8 et 72 octets.');
    }
    demoUserUpdate.$set.password_hash = await bcrypt.hash(process.env.DEMO_PASSWORD, 12);
  }
  const user = await User.findOneAndUpdate(
    { email: 'demo@budgettracker.local' },
    demoUserUpdate,
    { new: true, upsert: true }
  );
  const categories = await Promise.all(categoriesToSeed.map((category) => Category.findOneAndUpdate(
    { nom: category.nom },
    { $set: category },
    { new: true, upsert: true }
  )));

  const random = randomSource(20261015);
  const expenseCategories = categories.filter((category) => category.nom !== 'Salaire');
  const fixedStart = new Date('2025-01-01T00:00:00.000Z').getTime();
  const fixedEnd = new Date('2026-12-31T23:59:59.999Z').getTime();
  const titles = ['Courses hebdomadaires', 'Facture mensuelle', 'Paiement reçu', 'Achat en ligne', 'Sortie en famille', 'Abonnement', 'Remboursement'];
  const paymentMethods = ['Carte Bancaire', 'Espèces', 'Virement', 'Chèque'];
  const tags = ['maison', 'mensuel', 'famille', 'urgent', 'en ligne', 'essentiel', 'loisir'];

  const budgetOperations = categories.map((category) => ({
    updateOne: {
      filter: { user_id: user._id, categorie_id: category._id, mois: 10, annee: 2026 },
      update: { $set: { montant_alloue: category.plafond_mensuel || 1000 } },
      upsert: true
    }
  }));
  await Budget.bulkWrite(budgetOperations);

  await Transaction.deleteMany({ seeded: true });
  for (let offset = 0; offset < transactionCount; offset += 500) {
    const documents = [];
    const end = Math.min(offset + 500, transactionCount);
    for (let i = offset; i < end; i += 1) {
      const type = random() < 0.23 ? 'Revenu' : 'Dépense';
      const category = type === 'Revenu'
        ? categories.find((item) => item.nom === 'Salaire')
        : expenseCategories[Math.floor(random() * expenseCategories.length)];
      const details_articles = Array.from({ length: 1 + Math.floor(random() * 3) }, (_, index) => {
        const quantite = 1 + Math.floor(random() * 4);
        const prix_unitaire = roundMoney(2 + random() * 148);
        return { nom: `${titles[Math.floor(random() * titles.length)]} - article ${index + 1}`, quantite, prix_unitaire };
      });
      const montant_total = roundMoney(details_articles.reduce((sum, article) => sum + article.quantite * article.prix_unitaire, 0));
      documents.push({
        titre: titles[Math.floor(random() * titles.length)],
        type,
        montant_total,
        date_transaction: new Date(fixedStart + Math.floor(random() * (fixedEnd - fixedStart))),
        mode_paiement: paymentMethods[Math.floor(random() * paymentMethods.length)],
        tags: Array.from(new Set(Array.from({ length: 2 + Math.floor(random() * 3) }, () => tags[Math.floor(random() * tags.length)]))),
        user_id: user._id,
        categorie_id: category._id,
        details_articles,
        seeded: true
      });
    }
    await Transaction.insertMany(documents, { ordered: false });
    console.log(`Transactions préparées : ${end}/${transactionCount}`);
  }

  console.log(`Seed terminé : ${transactionCount} transactions, ${categories.length} catégories, 1 utilisateur et ${budgetOperations.length} budgets.`);
}

try {
  await seed();
} catch (error) {
  console.error('Échec du peuplement MongoDB :', error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
