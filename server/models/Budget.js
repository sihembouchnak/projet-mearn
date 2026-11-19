import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  categorie_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  mois: { type: Number, min: 1, max: 12, required: true },
  annee: { type: Number, required: true },
  montant_alloue: { type: Number, min: 0, required: true }
}, { timestamps: true });

budgetSchema.index({ user_id: 1, categorie_id: 1, mois: 1, annee: 1 }, { unique: true });

export default mongoose.model('Budget', budgetSchema);
