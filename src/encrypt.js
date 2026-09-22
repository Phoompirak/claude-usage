// เข้ารหัส snapshot ด้วย AES-256-GCM + คีย์ที่ derive จาก passphrase ผ่าน PBKDF2
// ฝั่งเบราว์เซอร์ถอดรหัสด้วย WebCrypto โดยใช้พารามิเตอร์ชุดเดียวกัน
//
// ไฟล์ที่ push ขึ้น GitHub Pages มีแต่ ciphertext — ต่อให้มีคนเดา URL เจอ
// ก็ไม่เห็นทั้งตัวเลข ชื่อโปรเจกต์ และป้ายชื่อบัญชี

import crypto from 'node:crypto';

export const KDF_ITERATIONS = 250_000;
const KEY_LEN = 32;
const IV_LEN = 12;
const SALT_LEN = 16;

/** ต่ำกว่านี้ถือว่าเสี่ยงพอที่จะเตือน — แต่ไม่ห้าม เจ้าของข้อมูลตัดสินใจเอง */
export const WEAK_PASSPHRASE_LENGTH = 12;

export function encryptJSON(obj, passphrase) {
  if (!passphrase) {
    throw new Error('ยังไม่ได้ตั้ง CU_PASSPHRASE');
  }
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = crypto.pbkdf2Sync(passphrase, salt, KDF_ITERATIONS, KEY_LEN, 'sha256');

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(obj), 'utf8');
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    v: 1,
    alg: 'AES-GCM',
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: KDF_ITERATIONS },
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    // WebCrypto คาดหวังให้ auth tag ต่อท้าย ciphertext
    ct: Buffer.concat([ct, tag]).toString('base64'),
  };
}

/** ใช้ตรวจสอบตอนพัฒนาว่าถอดรหัสกลับได้จริง */
export function decryptJSON(env, passphrase) {
  const salt = Buffer.from(env.salt, 'base64');
  const iv = Buffer.from(env.iv, 'base64');
  const blob = Buffer.from(env.ct, 'base64');
  const key = crypto.pbkdf2Sync(passphrase, salt, env.kdf.iterations, KEY_LEN, 'sha256');

  const tag = blob.subarray(blob.length - 16);
  const ct = blob.subarray(0, blob.length - 16);
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(ct), d.final()]).toString('utf8'));
}
