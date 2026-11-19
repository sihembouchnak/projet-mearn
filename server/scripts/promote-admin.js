import '../config/env.js';
import mongoose from 'mongoose';
import User from '../models/User.js';

const email = String(process.argv[2] ?? '').trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Utilisation : npm run admin:promote --workspace server -- adresse@example.com');
  process.exitCode = 1;
} else {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017', {
      dbName: process.env.MONGODB_DB || 'projet3'
    });
    const user = await User.findOne({ email });
    if (!user) throw new Error('Compte introuvable. Creez d’abord ce compte depuis la page d’inscription.');
    user.role = 'admin';
    user.status = 'approved';
    user.session_version = (user.session_version ?? 0) + 1;
    await user.save();
    console.log('Le compte administrateur est active. Reconnectez-vous pour charger les nouveaux droits.');
  } catch (error) {
    console.error('Impossible de promouvoir le compte administrateur :', error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  }
}
