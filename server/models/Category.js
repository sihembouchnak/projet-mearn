import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  nom: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: '', trim: true },
  plafond_mensuel: { type: Number, min: 0, default: 0 }
}, { timestamps: true });

export default mongoose.model('Category', categorySchema);
