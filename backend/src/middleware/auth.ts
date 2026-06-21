/**
 * Middleware d'authentification JWT + RBAC (Role-Based Access Control).
 *
 * Architecture :
 *   1. requireAuth   → vérifie le JWT, injecte req.user
 *   2. requireRole   → autorise uniquement les rôles listés
 *   3. requireSuperAdmin → raccourci pour Super Admin uniquement
 *   4. PERMISSIONS   → matrice ressource × action pour audit fin
 *   5. auditLog      → trace chaque action sensible en DB
 *
 * Token envoyé dans le header :
 *   Authorization: Bearer <token>
 *
 * Seul le SUPER_ADMIN peut :
 *   - Créer / modifier / supprimer des agents
 *   - Attribuer ou révoquer des rôles
 *   - Modifier le barème de sanctions
 *   - Corriger l'inventaire stock
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'elfirma_secret_key_2024';

// ─── Types ────────────────────────────────────────────────────
export interface AuthPayload {
  userId?: number;
  agentId?: number;
  role: string;
  nom?: string;
  posteType?: string;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

// ─── Constantes rôles ─────────────────────────────────────────
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  AGENT:       'agent',
  CONTROLEUR:  'controleur',
  COMPTABLE:   'comptable',
  LOGISTIQUE:  'logistique',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export const TOUS_ROLES    = Object.values(ROLES) as Role[];
export const ADMIN_ROLES   = [ROLES.SUPER_ADMIN] as Role[];
export const LECTURE_SEULE = [ROLES.CONTROLEUR]  as Role[];
export const OPERATEURS    = [ROLES.AGENT, ROLES.LOGISTIQUE] as Role[];

// ─── Matrice RBAC : ressource → action → rôles autorisés ─────
export const PERMISSIONS: Record<string, Record<string, Role[]>> = {
  agents: {
    read:   [ROLES.SUPER_ADMIN, ROLES.CONTROLEUR],
    create: [ROLES.SUPER_ADMIN],
    update: [ROLES.SUPER_ADMIN],
    delete: [ROLES.SUPER_ADMIN],
    assign_role: [ROLES.SUPER_ADMIN],
  },
  stock: {
    read:    TOUS_ROLES,
    create:  [ROLES.SUPER_ADMIN, ROLES.LOGISTIQUE, ROLES.AGENT],
    correct: [ROLES.SUPER_ADMIN],
  },
  expeditions: {
    pesee:     [ROLES.SUPER_ADMIN, ROLES.AGENT, ROLES.LOGISTIQUE],
    debloquer: [ROLES.SUPER_ADMIN, ROLES.CONTROLEUR],
  },
  retours: {
    controle:     [ROLES.SUPER_ADMIN, ROLES.AGENT, ROLES.LOGISTIQUE],
    clore_litige: [ROLES.SUPER_ADMIN, ROLES.CONTROLEUR, ROLES.COMPTABLE],
  },
  bilan: {
    read:     [ROLES.SUPER_ADMIN, ROLES.COMPTABLE],
    validate: [ROLES.SUPER_ADMIN],
  },
  bareme: {
    read:   TOUS_ROLES,
    update: [ROLES.SUPER_ADMIN],
  },
  alertes: {
    read:   TOUS_ROLES,
    resolve:[ROLES.SUPER_ADMIN, ROLES.CONTROLEUR, ROLES.COMPTABLE],
  },
};

// ─── 1. requireAuth — Vérification JWT ───────────────────────
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant ou invalide' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Token expiré ou invalide' });
  }
}

// ─── 2. requireRole — Contrôle rôle ──────────────────────────
export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Accès refusé',
        detail: `Rôles autorisés : [${roles.join(', ')}] — votre rôle : ${req.user.role}`,
      });
    }
    return next();
  };
}

// ─── 3. requireSuperAdmin — Raccourci SUPER_ADMIN ────────────
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
  if (req.user.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({
      error: 'Réservé Super Admin',
      detail: 'Cette action nécessite le rôle super_admin',
    });
  }
  return next();
}

// ─── 4. checkPermission — Vérification granulaire ────────────
export function checkPermission(resource: string, action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
    const allowed = PERMISSIONS[resource]?.[action];
    if (!allowed || !allowed.includes(req.user.role as Role)) {
      return res.status(403).json({
        error: 'Accès refusé',
        detail: `Permission [${resource}:${action}] non accordée au rôle ${req.user.role}`,
      });
    }
    return next();
  };
}

// ─── 5. auditLog — Trace async (non bloquant) ────────────────
export function auditLog(action: string, resource: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const agentId = req.user?.agentId ?? req.user?.userId ?? null;
    const role    = req.user?.role ?? 'unknown';
    pool.query(
      `INSERT INTO audit_logs (agent_id, role, action, resource, ip, created_at)
       VALUES ($1,$2,$3,$4,$5,NOW())`,
      [agentId, role, action, resource, req.ip]
    ).catch(() => { /* non bloquant */ });
    return next();
  };
}
