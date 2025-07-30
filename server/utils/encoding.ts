import { Buffer } from 'buffer';

/**
 * Properly decode and encode Japanese/CJK filenames
 * Handles common encoding issues with Japanese characters
 */
export function decodeFilename(filename: string): string {
  try {
    // If it's already a buffer, convert to string
    if (Buffer.isBuffer(filename)) {
      return filename.toString('utf8');
    }
    
    // Handle cases where filename might be improperly encoded
    if (typeof filename === 'string') {
      // First try URL decoding if it looks URL encoded
      if (filename.includes('%')) {
        try {
          const decoded = decodeURIComponent(filename);
          return decoded;
        } catch {
          // Continue to other methods if URL decoding fails
        }
      }
      
      // Check for common mojibake patterns (UTF-8 bytes interpreted as Latin-1)
      if (filename.includes('Ã') || filename.includes('â') || filename.includes('¢') || filename.includes('Â')) {
        try {
          // Convert from Latin-1 back to bytes, then decode as UTF-8
          const bytes = new Uint8Array(filename.length);
          for (let i = 0; i < filename.length; i++) {
            bytes[i] = filename.charCodeAt(i) & 0xFF; // Ensure single byte
          }
          const decoder = new TextDecoder('utf-8', { fatal: false });
          const decoded = decoder.decode(bytes);
          
          // Verify this looks like valid text (contains readable characters)
          if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u0020-\u007E]/.test(decoded)) {
            return decoded;
          }
        } catch {
          // Continue to fallback if conversion fails
        }
      }
      
      // Try to detect if it's already properly encoded UTF-8
      if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(filename)) {
        return filename; // Already contains Japanese characters, likely correct
      }
    }
    
    // If no conversion needed or all conversions failed, return original
    return filename;
  } catch (error) {
    console.warn('Failed to decode filename:', error);
    return filename;
  }
}

/**
 * Ensure proper UTF-8 encoding for filenames
 */
export function encodeFilename(filename: string): string {
  try {
    // Normalize Unicode characters (NFC normalization)
    const normalized = filename.normalize('NFC');
    
    // Convert to buffer and back to ensure proper UTF-8 encoding
    const buffer = Buffer.from(normalized, 'utf8');
    return buffer.toString('utf8');
  } catch (error) {
    console.warn('Failed to encode filename:', error);
    return filename;
  }
}

/**
 * Fix Japanese character encoding issues
 * This is the main function that should be used for fixing mojibake
 */
export function fixJapaneseEncoding(text: string): string {
  try {
    // Handle null or undefined
    if (!text || typeof text !== 'string') {
      return text || '';
    }
    
    // If already contains Japanese characters, likely already correct
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text)) {
      return text.normalize('NFC');
    }
    
    // Common mojibake patterns for Japanese text
    const mojibakePatterns = [
      // UTF-8 interpreted as Latin-1 patterns
      { pattern: /Ã¡/g, replacement: 'あ' },
      { pattern: /Ã¢/g, replacement: 'い' },
      { pattern: /Ã£/g, replacement: 'う' },
      { pattern: /Ã¤/g, replacement: 'え' },
      { pattern: /Ã¥/g, replacement: 'お' },
      // More comprehensive approach for general mojibake
    ];
    
    // Try to fix common mojibake patterns first
    let fixed = text;
    for (const { pattern, replacement } of mojibakePatterns) {
      fixed = fixed.replace(pattern, replacement);
    }
    
    // If we made changes, return the fixed version
    if (fixed !== text) {
      return fixed.normalize('NFC');
    }
    
    // Try the byte-level conversion approach
    if (text.includes('Ã') || text.includes('â') || text.includes('¢') || text.includes('Â')) {
      try {
        // Convert string to bytes assuming it was Latin-1 encoded UTF-8
        const bytes = new Uint8Array(text.length);
        for (let i = 0; i < text.length; i++) {
          bytes[i] = text.charCodeAt(i) & 0xFF;
        }
        
        // Decode as UTF-8
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const decoded = decoder.decode(bytes);
        
        // Check if the decoded version looks more like Japanese
        const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(decoded);
        const hasValidChars = /^[\u0020-\u007E\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF]+$/.test(decoded);
        
        if (hasJapanese && hasValidChars) {
          return decoded.normalize('NFC');
        }
      } catch (error) {
        console.warn('Byte-level conversion failed:', error);
      }
    }
    
    // Try different encoding assumptions
    const encodings = ['shift_jis', 'euc-jp', 'iso-2022-jp'];
    for (const encoding of encodings) {
      try {
        // This is a simplified approach - in a real implementation,
        // you might want to use a proper encoding detection library
        const buffer = Buffer.from(text, 'binary');
        // Note: Node.js doesn't support these encodings natively
        // You would need a library like 'iconv-lite' for full support
        // For now, we'll skip this approach
      } catch {
        continue;
      }
    }
    
    // If all else fails, return the original text normalized
    return text.normalize('NFC');
  } catch (error) {
    console.warn('Failed to fix Japanese encoding:', error);
    return text;
  }
}

/**
 * Detect if text appears to be mojibake (corrupted encoding)
 */
export function isMojibake(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }
  
  // Common mojibake indicators
  const mojibakeIndicators = [
    /Ã[¡-¿]/g,  // UTF-8 as Latin-1
    /â[€-™]/g,   // UTF-8 as Windows-1252
    /Â[¡-¿]/g,   // Another UTF-8 as Latin-1 pattern
    /[À-ÿ]{2,}/g // Multiple accented characters in sequence
  ];
  
  return mojibakeIndicators.some(pattern => pattern.test(text));
}

/**
 * Smart filename decoder that tries multiple approaches
 */
export function smartDecodeFilename(filename: string): string {
  try {
    // Step 1: Try URL decoding first
    if (filename.includes('%')) {
      try {
        const urlDecoded = decodeURIComponent(filename);
        if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(urlDecoded)) {
          return urlDecoded.normalize('NFC');
        }
      } catch {
        // Continue to next method
      }
    }
    
    // Step 2: Check if it's already properly encoded
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(filename)) {
      return filename.normalize('NFC');
    }
    
    // Step 3: Try to fix mojibake
    if (isMojibake(filename)) {
      const fixed = fixJapaneseEncoding(filename);
      if (fixed !== filename) {
        return fixed;
      }
    }
    
    // Step 4: Return original if nothing worked
    return filename.normalize('NFC');
  } catch (error) {
    console.warn('Smart decode failed:', error);
    return filename;
  }
}