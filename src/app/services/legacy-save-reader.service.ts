import { Injectable } from '@angular/core';

/**
 * READ-ONLY migration shim for saves written by Tag Spotter <= 1.1.0.
 *
 * Those builds wrapped the save in AES-GCM using a key derived from a password
 * and salt that were hardcoded in the shipped bundle. That was never a security
 * control — anyone could read the constants out of main.js — and it has been
 * removed from the write path (see dec-0009 in the Brain, audit F-20).
 *
 * This file exists for exactly one reason: a player who installed an older build
 * still has an encrypted blob on their device, and must not lose their trip. It
 * decrypts; it never encrypts. StateService rewrites anything it reads here as
 * plain JSON, so each save migrates forward on first load and this path stops
 * being reachable for that device.
 *
 * Delete this service once no supported upgrade path starts below 1.2.0.
 */

interface EncryptedEnvelope {
  version: 2;
  ciphertext: string;
}

export type SaveRead<T> =
  | { kind: 'plain'; value: T }
  | { kind: 'legacy'; value: T };

@Injectable({ providedIn: 'root' })
export class LegacySaveReaderService {
  // The derived key is deterministic, so derive once and reuse.
  private keyPromise: Promise<CryptoKey> | null = null;

  /**
   * Parses a stored value, transparently decrypting the two legacy shapes.
   * Callers should re-write anything returned as `legacy` in the current format.
   */
  async read<T>(raw: string): Promise<SaveRead<T>> {
    if (raw.startsWith('{') || raw.startsWith('[')) {
      const parsed: unknown = JSON.parse(raw);

      if (this.isEncryptedEnvelope(parsed)) {
        return { kind: 'legacy', value: JSON.parse(await this.decrypt(parsed.ciphertext)) as T };
      }

      return { kind: 'plain', value: parsed as T };
    }

    // Pre-v2: raw base64 with a detached checksum in a sibling `_sig` key.
    return { kind: 'legacy', value: JSON.parse(await this.decrypt(raw)) as T };
  }

  private isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
    return Boolean(value)
      && typeof value === 'object'
      && (value as Partial<EncryptedEnvelope>).version === 2
      && typeof (value as Partial<EncryptedEnvelope>).ciphertext === 'string';
  }

  private async decrypt(encryptedBase64: string): Promise<string> {
    const key = await this.getKey();
    const combined = this.base64ToBytes(encryptedBase64);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: combined.slice(0, 12) },
      key,
      combined.slice(12),
    );

    return new TextDecoder().decode(decrypted);
  }

  private getKey(): Promise<CryptoKey> {
    if (!this.keyPromise) {
      this.keyPromise = this.deriveKey();
    }
    return this.keyPromise;
  }

  private async deriveKey(): Promise<CryptoKey> {
    // These constants are published — they shipped inside every <= 1.1.0 bundle.
    // They are reproduced here only so old blobs remain readable.
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode('TagSpotter_1950_Americana_Secret_Encryption_Key'),
      { name: 'PBKDF2' },
      false,
      ['deriveKey'],
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('TagSpotter_Salt_1950'),
        iterations: 1000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
  }

  private base64ToBytes(base64: string): Uint8Array {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }
}
