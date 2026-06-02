import * as crypto from 'crypto';

/**
 * Cifrado simétrico para los access_token de GitHub.
 *
 * Algoritmo: AES-256-GCM (cifrado autenticado: garantiza confidencialidad +
 * integridad). La clave de 32 bytes se deriva por SHA-256 de
 * GITHUB_TOKEN_ENC_KEY (o, en dev, del JWT_SECRET como fallback).
 *
 * Formato almacenado:  ivBase64 : authTagBase64 : cipherBase64
 */
const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const secret =
    process.env.GITHUB_TOKEN_ENC_KEY ||
    process.env.JWT_SECRET ||
    'kanbana-dev-fallback-key-change-me';
  return crypto.createHash('sha256').update(secret).digest(); // 32 bytes
}

export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    tag.toString('base64'),
    enc.toString('base64'),
  ].join(':');
}

export function decryptToken(payload: string): string {
  const [ivB, tagB, encB] = payload.split(':');
  if (!ivB || !tagB || !encB) {
    throw new Error('Token cifrado con formato inválido');
  }
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encB, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Verifica la firma HMAC-SHA256 que GitHub envía en el header
 * X-Hub-Signature-256 (formato "sha256=<hex>"). Comparación en tiempo
 * constante para evitar timing attacks.
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const expected = `sha256=${hmac.digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
