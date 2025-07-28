import { Buffer } from 'buffer';

/**
 * Properly decode and encode Japanese/CJK filenames
 * Handles common encoding issues with Japanese characters
 */
export function decodeFilename(filename: string): string {
  try {
    // First try to decode as UTF-8
    if (Buffer.isBuffer(filename)) {
      return filename.toString('utf8');
    }
    
    // Handle cases where filename might be improperly encoded
    if (typeof filename === 'string') {
      // Check if it's already properly encoded
      try {
        const decoded = decodeURIComponent(filename);
        return decoded;
      } catch {
        // If decodeURIComponent fails, try direct buffer conversion
        const buffer = Buffer.from(filename, 'latin1');
        return buffer.toString('utf8');
      }
    }
    
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
    // Convert to buffer and back to ensure proper UTF-8 encoding
    const buffer = Buffer.from(filename, 'utf8');
    return buffer.toString('utf8');
  } catch (error) {
    console.warn('Failed to encode filename:', error);
    return filename;
  }
}

/**
 * Fix Japanese character encoding issues
 */
export function fixJapaneseEncoding(text: string): string {
  try {
    // Common issue: Latin-1 encoded Japanese characters
    if (text.includes('Ã') || text.includes('¢') || text.includes('â')) {
      const buffer = Buffer.from(text, 'latin1');
      const decoded = buffer.toString('utf8');
      
      // Check if the decoded version looks more like Japanese
      const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(decoded);
      if (hasJapanese) {
        return decoded;
      }
    }
    
    return text;
  } catch (error) {
    console.warn('Failed to fix Japanese encoding:', error);
    return text;
  }
}