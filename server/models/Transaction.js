import mongoose from 'mongoose';

const articleSchema = new mongoose.Schema({
  nom: { type: String, required: true, trim: true },
  quantite: { type: Number, required: true, min: 0.01 },
  prix_unitaire: { type: Number, required: true, min: 0 }
}, { _id: true });

const transactionSchema = new mongoose.Schema({
  titre: { type: String, required: true, trim: true, maxlength: 160 },
  type: { type: String, required: true, enum: ['Dépense', 'Revenu'] },
  montant_total: { type: Number, required: true, min: 0 },
  date_transaction: { type: Date, required: true, default: Date.now },
  mode_paiement: { type: String, default: 'Autre', trim: true },
  tags: { type: [String], default: [] },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  categorie_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  details_articles: { type: [articleSchema], default: [] },
  seeded: { type: Boolean, default: false, select: false }
}, { timestamps: true, collection: 'budget' });

transactionSchema.index({ titre: 'text', tags: 'text' }, { name: 'transaction_text_search' });
transactionSchema.index({ date_transaction: -1 });
transactionSchema.index({ categorie_id: 1, type: 1, date_transaction: -1 });
transactionSchema.index({ user_id: 1, date_transaction: -1 });

export default mongoose.model('Transaction', transactionSchema);
