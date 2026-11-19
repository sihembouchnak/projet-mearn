import './config/env.js';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import morgan from 'morgan';
import Budget from './models/Budget.js';
import Category from './models/Category.js';
import Transaction from './models/Transaction.js';
import User from './models/User.js';
import { authenticate, requireAdmin } from './auth/session.js';
import auth from './routes/auth.js';
import api from './routes/api.js';
import admin from './routes/admin.js';

const app = express();
const port = Number(process.env.PORT) || 5000;
let databaseInitialized = false;
let indexesReady = false;

function requireDatabase(req, res, next) {
  if (!databaseInitialized || mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message: 'MongoDB indisponible. Verifiez les identifiants Atlas et la liste Network Access.'
    });
  }
  next();
}

app.use(helmet());
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    const error = new Error('Origine non autorisee.');
    error.status = 403;
    return callback(error);
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan('dev'));
mongoose.connection.on('connected', () => {
  if (indexesReady) {
    databaseInitialized = true;
    console.log('Connexion MongoDB retablie.');
  }
});
mongoose.connection.on('disconnected', () => {
  databaseInitialized = false;
  console.error('Connexion MongoDB interrompue.');
});
app.get('/api/health', (req, res) => {
  const connected = databaseInitialized && mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'unavailable',
    database: connected ? mongoose.connection.name : 'disconnected'
  });
});
app.use('/api/auth', requireDatabase, auth);
app.use('/api/admin', requireDatabase, authenticate, requireAdmin, admin);
app.use('/api', requireDatabase, authenticate, api);
app.use((req, res) => res.status(404).json({ message: 'Route introuvable.' }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.status || (error.name === 'ValidationError' || error.name === 'CastError' ? 400 : 500);
  if (status >= 500) console.error(error);
  res.status(status).json({
    message: status >= 500 ? 'Une erreur serveur est survenue.' : error.message,
    ...(error.name === 'ValidationError' && { details: Object.values(error.errors).map((item) => item.message) })
  });
});

app.listen(port, () => console.log(`API BudgetTracker disponible sur http://localhost:${port}`));

try {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017', {
    serverSelectionTimeoutMS: 10000,
    dbName: process.env.MONGODB_DB || 'projet3'
  });
  await User.updateMany({ role: { $exists: false } }, { $set: { role: 'client' } });
  await User.updateMany({ status: { $exists: false } }, { $set: { status: 'approved' } });
  await Promise.all([Budget.init(), Category.init(), Transaction.init(), User.init()]);
  indexesReady = true;
  databaseInitialized = true;
  console.log(`MongoDB connecté : ${mongoose.connection.name} (${mongoose.connection.host})`);
} catch (error) {
  console.error('Connexion MongoDB impossible :', error.message);
  await mongoose.disconnect();
}
