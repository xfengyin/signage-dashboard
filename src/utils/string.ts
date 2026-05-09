/**
 * @fileOverview 字符串处理工具函数
 * @module utils/string
 */

export function truncate(str: string, length: number, suffix: string = '...'): string {
  if (!str || str.length <= length) return str;
  return str.slice(0, length - suffix.length) + suffix;
}

export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function capitalizeWords(str: string, delimiter: string = ' '): string {
  if (!str) return str;
  return str
    .split(delimiter)
    .map(word => capitalize(word))
    .join(delimiter);
}

export function camelCase(str: string): string {
  if (!str) return str;
  return str
    .replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '')
    .replace(/^(.)/, (char) => char.toLowerCase());
}

export function snakeCase(str: string): string {
  if (!str) return str;
  return str
    .replace(/([A-Z])/g, '_$1')
    .replace(/[-\s]+/g, '_')
    .replace(/^_/, '')
    .toLowerCase();
}

export function kebabCase(str: string): string {
  if (!str) return str;
  return str
    .replace(/([A-Z])/g, '-$1')
    .replace(/[_\s]+/g, '-')
    .replace(/^-/, '')
    .toLowerCase();
}

export function pascalCase(str: string): string {
  if (!str) return str;
  return camelCase(str).replace(/^[a-z]/, char => char.toUpperCase());
}

export function titleCase(str: string): string {
  if (!str) return str;
  return str.replace(
    /\w\S*/g,
    txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

export function lowerCase(str: string): string {
  return str ? str.toLowerCase() : str;
}

export function upperCase(str: string): string {
  return str ? str.toUpperCase() : str;
}

export function trim(str: string, chars?: string): string {
  if (!chars) return str ? str.trim() : str;
  const pattern = new RegExp(`^[${chars}]+|[${chars}]+$`, 'g');
  return str.replace(pattern, '');
}

export function trimStart(str: string, chars?: string): string {
  if (!chars) return str ? str.trimStart() : str;
  const pattern = new RegExp(`^[${chars}]+`, 'g');
  return str.replace(pattern, '');
}

export function trimEnd(str: string, chars?: string): string {
  if (!chars) return str ? str.trimEnd() : str;
  const pattern = new RegExp(`[${chars}]+$`, 'g');
  return str.replace(pattern, '');
}

export function padStart(str: string | number, length: number, char: string = ' '): string {
  return String(str).padStart(length, char);
}

export function padEnd(str: string | number, length: number, char: string = ' '): string {
  return String(str).padEnd(length, char);
}

export function repeat(str: string, count: number): string {
  if (!str || count < 0) return str;
  return str.repeat(count);
}

export function reverse(str: string): string {
  return str ? str.split('').reverse().join('') : str;
}

export function slugify(str: string): string {
  if (!str) return str;
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function unslugify(str: string): string {
  if (!str) return str;
  return str
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

export function escapeHtml(str: string): string {
  if (!str) return str;
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return str.replace(/[&<>"']/g, char => entities[char]);
}

export function unescapeHtml(str: string): string {
  if (!str) return str;
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
  };
  return str.replace(/&(amp|lt|gt|quot|#39);/g, match => entities[match]);
}

export function escapeJson(str: string): string {
  if (!str) return str;
  return JSON.stringify(str);
}

export function escapeRegex(str: string): string {
  if (!str) return str;
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function escapeShell(str: string): string {
  if (!str) return str;
  return str.replace(/'/g, "'\\''");
}

export function unescapeShell(str: string): string {
  if (!str) return str;
  return str.replace(/'\\''/g, "'");
}

export function indent(str: string, spaces: number = 2, indentChar: string = ' '): string {
  if (!str) return str;
  const prefix = indentChar.repeat(spaces);
  return str.replace(/^/gm, prefix);
}

export function dedent(str: string): string {
  if (!str) return str;
  const lines = str.split('\n');
  const minIndent = lines
    .filter(line => line.trim())
    .reduce((min, line) => {
      const match = line.match(/^(\s*)/);
      return Math.min(min, match ? match[1].length : 0);
    }, Infinity);
  
  return lines
    .map(line => line.slice(minIndent))
    .join('\n');
}

export function normalizeWhitespace(str: string): string {
  if (!str) return str;
  return str.replace(/\s+/g, ' ').trim();
}

export function removeWhitespace(str: string): string {
  if (!str) return str;
  return str.replace(/\s/g, '');
}

export function removeExtraSpaces(str: string): string {
  if (!str) return str;
  return str.replace(/\s+/g, ' ').trim();
}

export function splitLines(str: string, preserveEmpty: boolean = false): string[] {
  if (!str) return [];
  const lines = str.split(/\r?\n/);
  return preserveEmpty ? lines : lines.filter(line => line.length > 0);
}

export function joinLines(lines: string[], separator: string = '\n'): string {
  if (!lines || lines.length === 0) return '';
  return lines.join(separator);
}

export function wordCount(str: string): number {
  if (!str) return 0;
  return str.trim().split(/\s+/).filter(word => word.length > 0).length;
}

export function charCount(str: string, includeSpaces: boolean = true): number {
  if (!str) return 0;
  return includeSpaces ? str.length : str.replace(/\s/g, '').length;
}

export function lineCount(str: string): number {
  if (!str) return 0;
  return str.split(/\r?\n/).length;
}

export function contains(str: string, search: string | RegExp, caseSensitive: boolean = true): boolean {
  if (!str || !search) return false;
  if (search instanceof RegExp) {
    return caseSensitive ? search.test(str) : new RegExp(search.source, search.flags + 'i').test(str);
  }
  return caseSensitive ? str.includes(search) : str.toLowerCase().includes(search.toLowerCase());
}

export function startsWithIgnoreCase(str: string, prefix: string): boolean {
  if (!str || !prefix) return false;
  return str.toLowerCase().startsWith(prefix.toLowerCase());
}

export function endsWithIgnoreCase(str: string, suffix: string): boolean {
  if (!str || !suffix) return false;
  return str.toLowerCase().endsWith(suffix.toLowerCase());
}

export function equalsIgnoreCase(str1: string, str2: string): boolean {
  if (!str1 || !str2) return str1 === str2;
  return str1.toLowerCase() === str2.toLowerCase();
}

export function isEmpty(str: string | null | undefined): boolean {
  return !str || str.length === 0;
}

export function isBlank(str: string | null | undefined): boolean {
  return !str || str.trim().length === 0;
}

export function isNumeric(str: string): boolean {
  if (!str) return false;
  return /^\d+$/.test(str);
}

export function isAlpha(str: string): boolean {
  if (!str) return false;
  return /^[a-zA-Z]+$/.test(str);
}

export function isAlphanumeric(str: string): boolean {
  if (!str) return false;
  return /^[a-zA-Z0-9]+$/.test(str);
}

export function isEmail(str: string): boolean {
  if (!str) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(str);
}

export function isUrl(str: string): boolean {
  if (!str) return false;
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

export function isPhone(str: string): boolean {
  if (!str) return false;
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(str.replace(/\s/g, ''));
}

export function isPostalCode(str: string, country: string = 'CN'): boolean {
  if (!str) return false;
  const patterns: Record<string, RegExp> = {
    CN: /^\d{6}$/,
    US: /^\d{5}(-\d{4})?$/,
    UK: /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i,
    JP: /^\d{3}-?\d{4}$/,
  };
  const pattern = patterns[country.toUpperCase()] || /^\d+$/;
  return pattern.test(str);
}

export function isUUID(str: string): boolean {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export function matches(str: string, pattern: string | RegExp): boolean {
  if (!str || !pattern) return false;
  if (pattern instanceof RegExp) {
    return pattern.test(str);
  }
  return new RegExp(pattern).test(str);
}

export function replaceAll(str: string, search: string, replacement: string): string {
  if (!str || !search) return str;
  return str.split(search).join(replacement);
}

export function replacePattern(str: string, pattern: RegExp, replacement: string | ((match: string, ...args: any[]) => string)): string {
  if (!str || !pattern) return str;
  return str.replace(pattern, replacement as any);
}

export function extractNumbers(str: string): number[] {
  if (!str) return [];
  const matches = str.match(/-?\d+\.?\d*/g);
  return matches ? matches.map(n => parseFloat(n)) : [];
}

export function extractEmails(str: string): string[] {
  if (!str) return [];
  const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
  const matches = str.match(emailRegex);
  return matches || [];
}

export function extractUrls(str: string): string[] {
  if (!str) return [];
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
  const matches = str.match(urlRegex);
  return matches || [];
}

export function extractByPattern(str: string, pattern: RegExp): string[] {
  if (!str || !pattern) return [];
  const matches = str.match(pattern);
  return matches || [];
}

export function hashCode(str: string): number {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function md5(str: string): string {
  if (!str) return str;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    return crypto.subtle.digest('MD5', data).then(buffer => {
      const hashArray = Array.from(new Uint8Array(buffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }) as any;
  }
  return hashCode(str).toString(16);
}

export function sha256(str: string): string {
  if (!str) return str;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    return crypto.subtle.digest('SHA-256', data).then(buffer => {
      const hashArray = Array.from(new Uint8Array(buffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }) as any;
  }
  return hashCode(str).toString(16);
}

export function base64Encode(str: string): string {
  if (!str) return str;
  if (typeof btoa !== 'undefined') {
    return btoa(unescape(encodeURIComponent(str)));
  }
  return Buffer.from(str).toString('base64');
}

export function base64Decode(str: string): string {
  if (!str) return str;
  if (typeof atob !== 'undefined') {
    return decodeURIComponent(escape(atob(str)));
  }
  return Buffer.from(str, 'base64').toString('utf-8');
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function generateRandomString(length: number, charset?: string): string {
  const defaultCharset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const chars = charset || defaultCharset;
  let result = '';
  const randomValues = new Uint32Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomValues);
  } else {
    for (let i = 0; i < length; i++) {
      randomValues[i] = Math.floor(Math.random() * 0xFFFFFFFF);
    }
  }
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

export function generateRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomChoice<T>(array: T[]): T | undefined {
  if (!array || array.length === 0) return undefined;
  return array[Math.floor(Math.random() * array.length)];
}

export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function unique<T>(array: T[]): T[] {
  return array ? [...new Set(array)] : [];
}

export function uniqueBy<T>(array: T[], key: keyof T | ((item: T) => unknown)): T[] {
  if (!array) return [];
  const seen = new Set();
  const getKey = typeof key === 'function' ? key : (item: T) => item[key];
  return array.filter(item => {
    const k = getKey(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function sortBy<T>(array: T[], key: keyof T | ((item: T) => unknown)): T[] {
  if (!array) return [];
  const getKey = typeof key === 'function' ? key : (item: T) => item[key];
  return [...array].sort((a, b) => {
    const aKey = getKey(a);
    const bKey = getKey(b);
    if (aKey < bKey) return -1;
    if (aKey > bKey) return 1;
    return 0;
  });
}

export function sortByDesc<T>(array: T[], key: keyof T | ((item: T) => unknown)): T[] {
  return sortBy(array, key).reverse();
}

export function groupBy<T>(array: T[], key: keyof T | ((item: T) => unknown)): Record<string, T[]> {
  if (!array) return {};
  const getKey = typeof key === 'function' ? key : (item: T) => String(item[key]);
  return array.reduce((result, item) => {
    const k = getKey(item);
    if (!result[k]) result[k] = [];
    result[k].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

export function chunk<T>(array: T[], size: number): T[][] {
  if (!array || size < 1) return [];
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export function partition<T>(array: T[], predicate: ((item: T) => boolean) | T): [T[], T[]] {
  if (!array) return [[], []];
  const isFn = typeof predicate === 'function';
  const truthy: T[] = [];
  const falsy: T[] = [];
  for (const item of array) {
    if (isFn ? (predicate as (item: T) => boolean)(item) : item === predicate) {
      truthy.push(item);
    } else {
      falsy.push(item);
    }
  }
  return [truthy, falsy];
}

export function flatten<T>(array: (T | T[])[]): T[] {
  if (!array) return [];
  return array.reduce<T[]>((result, item) => {
    if (Array.isArray(item)) {
      result.push(...item);
    } else {
      result.push(item);
    }
    return result;
  }, []);
}

export function deepFlatten<T>(array: unknown[]): T[] {
  if (!array) return [];
  return array.reduce<T[]>((result, item) => {
    if (Array.isArray(item)) {
      result.push(...deepFlatten<T>(item));
    } else {
      result.push(item as T);
    }
    return result;
  }, []);
}

export function zip<T>(...arrays: T[][]): T[][] {
  if (arrays.length === 0) return [];
  const length = Math.min(...arrays.map(a => a.length));
  const result: T[][] = [];
  for (let i = 0; i < length; i++) {
    result.push(arrays.map(a => a[i]));
  }
  return result;
}

export function unzip<T>(array: T[][]): T[][] {
  if (!array || array.length === 0) return [];
  const numArrays = array[0].length;
  const result: T[][] = Array.from({ length: numArrays }, () => []);
  for (const tuple of array) {
    for (let i = 0; i < numArrays; i++) {
      result[i].push(tuple[i]);
    }
  }
  return result;
}

export function difference<T>(arr1: T[], arr2: T[]): T[] {
  if (!arr1 || !arr2) return arr1 || [];
  const set2 = new Set(arr2);
  return arr1.filter(item => !set2.has(item));
}

export function intersection<T>(arr1: T[], arr2: T[]): T[] {
  if (!arr1 || !arr2) return [];
  const set2 = new Set(arr2);
  return arr1.filter(item => set2.has(item));
}

export function union<T>(...arrays: T[][]): T[] {
  if (arrays.length === 0) return [];
  const result: T[] = [];
  const seen = new Set();
  for (const array of arrays) {
    for (const item of array) {
      if (!seen.has(item)) {
        seen.add(item);
        result.push(item);
      }
    }
  }
  return result;
}

export function isSubset<T>(subset: T[], superset: T[]): boolean {
  if (!subset) return true;
  if (!superset) return false;
  const set = new Set(superset);
  return subset.every(item => set.has(item));
}

export function isSuperset<T>(superset: T[], subset: T[]): boolean {
  return isSubset(subset, superset);
}
