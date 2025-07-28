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
  // Since we're now handling encoding properly at the server level,
  // we primarily just return the text as-is. The server should send
  // properly decoded filenames.
  return text;
}