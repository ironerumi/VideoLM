/**
 * Client-side utilities for handling Japanese/CJK character encoding
 */

/**
 * Ensure proper encoding for file names when uploading
 */
export function encodeFileName(fileName: string): string {
  try {
    // Ensure the filename is properly encoded for transmission
    return encodeURIComponent(fileName);
  } catch (error) {
    console.warn('Failed to encode filename:', error);
    return fileName;
  }
}

/**
 * Decode filename received from server
 */
export function decodeFileName(fileName: string): string {
  try {
    // Try to decode the filename
    return decodeURIComponent(fileName);
  } catch (error) {
    console.warn('Failed to decode filename:', error);
    return fileName;
  }
}

/**
 * Check if text contains Japanese characters
 */
export function hasJapaneseCharacters(text: string): boolean {
  // Check for Hiragana, Katakana, and Kanji characters
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);
}

/**
 * Fix common encoding issues with Japanese characters
 */
export function fixJapaneseDisplay(text: string): string {
  try {
    // If the text looks like it has encoding issues, try to fix it
    if (text.includes('Ã') || text.includes('¢') || text.includes('â')) {
      // This might be incorrectly encoded Japanese text
      // Try to decode it properly
      const bytes = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) {
        bytes[i] = text.charCodeAt(i);
      }
      const decoder = new TextDecoder('utf-8');
      const decoded = decoder.decode(bytes);
      
      // Check if the result looks better (contains Japanese characters)
      if (hasJapaneseCharacters(decoded)) {
        return decoded;
      }
    }
    
    return text;
  } catch (error) {
    console.warn('Failed to fix Japanese display:', error);
    return text;
  }
}