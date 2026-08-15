import { TestBed } from '@angular/core/testing';

import { LegacySaveReaderService } from './legacy-save-reader.service';

/**
 * This service only exists so that upgrading players keep their trip (audit
 * F-20). It is the one piece of the save path with no second chance — if it
 * mis-reads, progress is silently gone — so it is tested against ciphertext
 * produced the same way v1.1.0 produced it, not against a stored fixture.
 */
describe('LegacySaveReaderService', () => {
  let service: LegacySaveReaderService;

  async function encryptLikeVersion1_1(plaintext: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode('TagSpotter_1950_Americana_Secret_Encryption_Key'),
      { name: 'PBKDF2' },
      false,
      ['deriveKey'],
    );
    const key = await window.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: encoder.encode('TagSpotter_Salt_1950'), iterations: 1000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt'],
    );

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext));
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    let binary = '';
    combined.forEach((byte) => { binary += String.fromCharCode(byte); });
    return window.btoa(binary);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LegacySaveReaderService);
  });

  it('reads current-format plain JSON objects without touching crypto', async () => {
    const result = await service.read<{ points: number }>(JSON.stringify({ points: 12 }));

    expect(result.kind).toBe('plain');
    expect(result.value).toEqual({ points: 12 });
  });

  it('reads current-format plain JSON arrays', async () => {
    const result = await service.read<Array<{ ID: number }>>(JSON.stringify([{ ID: 4 }]));

    expect(result.kind).toBe('plain');
    expect(result.value).toEqual([{ ID: 4 }]);
  });

  it('decrypts a v2 envelope and flags it for migration', async () => {
    const original = { states: [{ ID: 1, fnd: { stateFound: true } }] };
    const envelope = JSON.stringify({ version: 2, ciphertext: await encryptLikeVersion1_1(JSON.stringify(original)) });

    const result = await service.read<typeof original>(envelope);

    expect(result.kind).toBe('legacy');
    expect(result.value).toEqual(original);
  });

  it('decrypts a pre-v2 raw base64 value and flags it for migration', async () => {
    const original = [{ ID: 9, fnd: { distance: 250 } }];

    const result = await service.read<typeof original>(await encryptLikeVersion1_1(JSON.stringify(original)));

    expect(result.kind).toBe('legacy');
    expect(result.value).toEqual(original);
  });

  it('rejects a tampered ciphertext rather than returning partial data', async () => {
    const encrypted = await encryptLikeVersion1_1(JSON.stringify({ points: 1 }));
    // AES-GCM authenticates the payload, so a flipped byte must fail outright.
    const tampered = `${encrypted.slice(0, -8)}AAAAAAAA`;

    await expectAsync(service.read(tampered)).toBeRejected();
  });

  it('rejects a value that is neither JSON nor base64 ciphertext', async () => {
    await expectAsync(service.read('not-json-and-not-base64!!')).toBeRejected();
  });
});
