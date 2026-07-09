import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ChecksumService {
  private readonly SALT = 'TagSpotter_1950_Americana_Secret_Salt';

  /**
   * Generates a secure cryptographic SHA-256 checksum signature for a string.
   */
  async generateChecksum(data: string): Promise<string> {
    const saltedData = data + this.SALT;
    const msgUint8 = new TextEncoder().encode(saltedData);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verifies if the data matches the provided checksum.
   */
  async verify(data: string, checksum: string): Promise<boolean> {
    const actual = await this.generateChecksum(data);
    return actual === checksum;
  }
}
