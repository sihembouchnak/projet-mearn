import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { authenticate, clearSessionCookie, setSessionCookie } from '../auth/session.js';

const router = Router();
const passwordMinLength = 8;
const passwordMaxBytes = 72;

function publicUser(user) {
  return {
    id: user._id,
    nom_complet: user.nom_complet,
    email: user.email,
    role: user.role ?? 'client',
    status: user.status ?? 'approved',
    devise: user.devise,
    date_inscription: user.date_inscription
  };
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

router.post('/register', async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const nom_complet = typeof body.nom_complet === 'string' ? body.nom_complet.trim() : '';
    const email = normalizeEmail(body.email);
    const password = body.password;

    if (nom_complet.length < 2 || nom_complet.length > 80) {
      return res.status(400).json({ message: 'Le nom doit contenir entre 2 et 80 caracteres.' });
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Veuillez saisir une adresse e-mail valide.' });
    }
    if (typeof password !== 'string' || password.length < passwordMinLength || Buffer.byteLength(password, 'utf8') > passwordMaxBytes) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 8 caracteres et au plus 72 octets.' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const user = await User.create({ nom_complet, email, password_hash, role: 'client', status: 'pending' });
    res.status(201).json({
      pendingApproval: true,
      message: 'Votre demande de compte a ete envoyee. Vous pourrez vous connecter apres validation par l’administrateur.',
      user: publicUser(user)
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Un compte utilise deja cette adresse e-mail.' });
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const email = normalizeEmail(body.email);
    const password = body.password;
    if (!email || typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Adresse e-mail et mot de passe obligatoires.' });
    }
    if (Buffer.byteLength(password, 'utf8') > passwordMaxBytes) {
      return res.status(401).json({ message: 'Adresse e-mail ou mot de passe incorrect.' });
    }

    const user = await User.findOne({ email }).select('+password_hash');
    const passwordMatches = user?.password_hash
      ? await bcrypt.compare(password, user.password_hash)
      : false;
    if (!user || !passwordMatches) {
      return res.status(401).json({ message: 'Adresse e-mail ou mot de passe incorrect.' });
    }
    if (user.status === 'pending') {
      return res.status(403).json({ message: 'Votre compte est en attente de validation par l’administrateur.' });
    }
    if (user.status === 'rejected') {
      return res.status(403).json({ message: 'Votre demande de compte a ete refusee. Contactez l’administrateur.' });
    }

    setSessionCookie(res, user);
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await User.updateOne({ _id: req.userId }, { $inc: { session_version: 1 } });
    clearSessionCookie(res);
    res.json({ message: 'Vous etes deconnecte.' });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      clearSessionCookie(res);
      return res.status(401).json({ message: 'Compte introuvable. Veuillez vous reconnecter.' });
    }
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

export default router;
