import '../config/env.js';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';

const configuredSecret = process.env.JWT_SECRET;

if (process.env.NODE_ENV === 'production' && (!configuredSecret || Buffer.byteLength(configuredSecret) < 32)) {
  throw new Error('En production, JWT_SECRET doit contenir au moins 32 octets aleatoires.');
}

const jwtSecret = configuredSecret || randomBytes(32).toString('hex');
if (!configuredSecret) {
  console.warn('JWT_SECRET absent : cle de session temporaire generee pour le developpement.');
}

export const authCookieName = 'budget_session';
const sessionDurationMs = 8 * 60 * 60 * 1000;

export function createSessionToken(user) {
  return jwt.sign(
    { version: user.session_version ?? 0 },
    jwtSecret,
    { subject: String(user._id), expiresIn: '8h', issuer: 'budget-tracker' }
  );
}

export function setSessionCookie(res, user) {
  res.cookie(authCookieName, createSessionToken(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api',
    maxAge: sessionDurationMs
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(authCookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api'
  });
}

export async function authenticate(req, res, next) {
  const token = req.cookies?.[authCookieName];
  if (!token) return res.status(401).json({ message: 'Veuillez vous connecter pour continuer.' });

  let payload;
  try {
    payload = jwt.verify(token, jwtSecret, { issuer: 'budget-tracker' });
  } catch {
    clearSessionCookie(res);
    return res.status(401).json({ message: 'Votre session a expire. Veuillez vous reconnecter.' });
  }

  if (typeof payload.sub !== 'string' || !mongoose.isValidObjectId(payload.sub)) {
    clearSessionCookie(res);
    return res.status(401).json({ message: 'Votre session est invalide. Veuillez vous reconnecter.' });
  }

  try {
    const user = await User.findById(payload.sub).select('session_version role status');
    if (!user || payload.version !== (user.session_version ?? 0)) {
      clearSessionCookie(res);
      return res.status(401).json({ message: 'Votre session a ete fermee. Veuillez vous reconnecter.' });
    }
    if (user.status && user.status !== 'approved') {
      clearSessionCookie(res);
      return res.status(403).json({ message: 'Votre compte n’est pas approuve.' });
    }
    req.userId = payload.sub;
    req.userRole = user.role ?? 'client';
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ message: 'Cette action est reservee a l’administrateur.' });
  }
  next();
}
