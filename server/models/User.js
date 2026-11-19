import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  nom_complet: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  password_hash: { type: String, select: false },
  session_version: { type: Number, default: 0 },
  devise: { type: String, default: 'TND', trim: true },
  date_inscription: { type: Date, default: Date.now }
}, { timestamps: true });

userSchema.set('toJSON', {
  transform(document, result) {
    delete result.password_hash;
    delete result.__v;
    return result;
  }
});

export default mongoose.model('User', userSchema);
