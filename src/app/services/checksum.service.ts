import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ChecksumService {
  private readonly SALT = 'TagSpotter_1950_Americana_Secret_Salt';

  /**
   * Generates a hardened 64-bit composite hash for a string using a salted 
   * FNV-1a inspired approach. This reduces collision risk compared to simple 
   * 32-bit non-cryptographic hashes.
   */
  generateChecksum(data: string): string {
    const saltedData = data + this.SALT;
    let h1 = 0x811c9dc5; // FNV offset basis
    let h2 = 0x0db91908; // Secondary basis for bit diffusion

    for (let i = 0; i < saltedData.length; i++) {
      const char = saltedData.charCodeAt(i);
      // FNV-1a primary
      h1 = Math.imul(h1 ^ char, 0x01000193);
      // Secondary mixing for diffusion
      h2 = Math.imul(h2 ^ char, 31) + h1;
    }
    
    // Return a composite hex string (effectively 64-bit)
    return (h1 >>> 0).toString(16).padStart(8, '0') + 
           (h2 >>> 0).toString(16).padStart(8, '0');
  }

  /**
   * Verifies if the data matches the provided checksum.
   */
  verify(data: string, checksum: string): boolean {
    return this.generateChecksum(data) === checksum;
  }
}
