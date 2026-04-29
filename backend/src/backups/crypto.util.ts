import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes, createHash } from 'node:crypto';

/**
 * AES-256-GCM con PBKDF2-SHA256 600k iteraciones (OWASP 2023).
 * Formato del output: { salt, iv, tag, ciphertext } todos en base64.
 */
export interface EncryptionMeta {
  algo: 'aes-256-gcm';
  kdf: 'pbkdf2-sha256';
  iterations: number;
  salt: string; // base64
  iv: string;   // base64
  tag: string;  // base64
}

const PBKDF2_ITER = 600_000;

export function deriveKey(password: string, salt: Buffer): Buffer {
  return pbkdf2Sync(password, salt, PBKDF2_ITER, 32, 'sha256');
}

export function encryptBuffer(plain: Buffer, password: string): { ciphertext: Buffer; meta: EncryptionMeta } {
  const salt = randomBytes(16);
  const iv = randomBytes(12); // 96 bits recomendado para GCM
  const key = deriveKey(password, salt);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext,
    meta: {
      algo: 'aes-256-gcm',
      kdf: 'pbkdf2-sha256',
      iterations: PBKDF2_ITER,
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
    },
  };
}

export function decryptBuffer(ciphertext: Buffer, password: string, meta: EncryptionMeta): Buffer {
  if (meta.algo !== 'aes-256-gcm' || meta.kdf !== 'pbkdf2-sha256') {
    throw new Error(`Algoritmo no soportado: ${meta.algo} / ${meta.kdf}`);
  }
  const salt = Buffer.from(meta.salt, 'base64');
  const iv = Buffer.from(meta.iv, 'base64');
  const tag = Buffer.from(meta.tag, 'base64');
  const key = pbkdf2Sync(password, salt, meta.iterations, 32, 'sha256');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (e) {
    throw new Error('Contraseña incorrecta o archivo corrupto');
  }
}

export function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}
