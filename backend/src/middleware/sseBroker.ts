/**
 * SSE Broker centralisé — diffuse les événements temps réel
 * à tous les dashboards abonnés (logistique, contrôleur, super_admin, comptable).
 *
 * Usage dans une route :
 *   import { broadcastGlobal, registerSseClient } from '../middleware/sseBroker';
 *   broadcastGlobal('STOCK_MISE_A_JOUR', { ... });
 *
 * Endpoint SSE global : GET /api/v1/events/stream
 * (monté dans index.ts — voir en bas)
 */

import { Request, Response } from 'express';

interface SseClient {
  id: number;
  res: Response;
  role?: string;
}

let clients: SseClient[] = [];
let nextId = 0;

// ─── Enregistrer un client SSE ────────────────────────────────
export function registerSseClient(req: Request, res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const id = ++nextId;
  const role = (req as any).user?.role;
  clients.push({ id, res, role });

  // Ping anti-timeout
  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(ping); }
  }, 25_000);

  req.on('close', () => {
    clearInterval(ping);
    clients = clients.filter(c => c.id !== id);
  });
}

// ─── Diffuser à tous les clients ─────────────────────────────
export function broadcastGlobal(event: string, payload: object): void {
  const msg = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  clients.forEach(c => {
    try { c.res.write(msg); } catch { /* client déconnecté */ }
  });
}

// ─── Diffuser à des rôles spécifiques ────────────────────────
export function broadcastToRoles(event: string, payload: object, roles: string[]): void {
  const msg = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  clients
    .filter(c => !c.role || roles.includes(c.role))
    .forEach(c => {
      try { c.res.write(msg); } catch { /* client déconnecté */ }
    });
}

export function getClientCount(): number {
  return clients.length;
}
