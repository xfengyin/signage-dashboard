/**
 * @fileOverview 对象处理工具函数
 * @module utils/object
 */

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as any;
  if (obj instanceof RegExp) return new RegExp(obj.source, obj.flags) as any;
  if (obj instanceof Map) {
    const map = new Map();
    obj.forEach((value, key) => map.set(key, deepClone(value)));
    return map as any;
  }
  if (obj instanceof Set) {
    const set = new Set();
    obj.forEach(value => set.add(deepClone(value)));
    return set as any;
  }
  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

export function deepMerge<T extends object>(target: T, ...sources: Partial<T>[]): T {
  if (!sources.length) return target;
  const source = sources.shift();
  if (isEmpty(source)) return deepMerge(target, ...sources);

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const targetValue = (target as any)[key];
      const sourceValue = (source as any)[key];
      if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
        (target as any)[key] = deepMerge(targetValue, sourceValue);
      } else {
        (target as any)[key] = deepClone(sourceValue);
      }
    }
  }
  return deepMerge(target, ...sources);
}

export function deepEqual(obj1: unknown, obj2: unknown, visited: WeakSet<object> = new WeakSet()): boolean {
  if (obj1 === obj2) return true;
  if (obj1 === null || obj2 === null) return obj1 === obj2;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return obj1 === obj2;

  const obj1Obj = obj1 as object;
  const obj2Obj = obj2 as object;

  if (obj1Obj instanceof Date && obj2Obj instanceof Date) {
    return obj1Obj.getTime() === obj2Obj.getTime();
  }
  if (obj1Obj instanceof RegExp && obj2Obj instanceof RegExp) {
    return obj1Obj.toString() === obj2Obj.toString();
  }
  if (obj1Obj instanceof Array && obj2Obj instanceof Array) {
    if (obj1Obj.length !== obj2Obj.length) return false;
    return obj1Obj.every((item, index) => deepEqual(item, obj2Obj[index], visited));
  }
  if (obj1Obj instanceof Map && obj2Obj instanceof Map) {
    if (obj1Obj.size !== obj2Obj.size) return false;
    for (const [key, value] of obj1Obj) {
      if (!obj2Obj.has(key) || !deepEqual(value, obj2Obj.get(key), visited)) return false;
    }
    return true;
  }
  if (obj1Obj instanceof Set && obj2Obj instanceof Set) {
    if (obj1Obj.size !== obj2Obj.size) return false;
    for (const value of obj1Obj) {
      if (!obj2Obj.has(value)) return false;
    }
    return true;
  }

  if (visited.has(obj1Obj) || visited.has(obj2Obj)) return obj1Obj === obj2Obj;
  visited.add(obj1Obj);
  visited.add(obj2Obj);

  const keys1 = Object.keys(obj1Obj);
  const keys2 = Object.keys(obj2Obj);
  if (keys1.length !== keys2.length) return false;

  return keys1.every(key => deepEqual((obj1Obj as any)[key], (obj2Obj as any)[key], visited));
}

export function isEqual(obj1: unknown, obj2: unknown): boolean {
  return deepEqual(obj1, obj2);
}

export function isDeepEqual(obj1: unknown, obj2: unknown): boolean {
  return deepEqual(obj1, obj2);
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  if (!obj) return {} as Pick<T, K>;
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  if (!obj) return {} as Omit<T, K>;
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

export function pickBy<T extends object>(obj: T, predicate: (value: T[keyof T], key: keyof T) => boolean): Partial<T> {
  if (!obj) return {};
  const result: Partial<T> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && predicate(obj[key], key)) {
      result[key] = obj[key];
    }
  }
  return result;
}

export function omitBy<T extends object>(obj: T, predicate: (value: T[keyof T], key: keyof T) => boolean): Partial<T> {
  return pickBy(obj, (value, key) => !predicate(value, key));
}

export function get(obj: any, path: string | string[], defaultValue?: unknown): unknown {
  if (!obj) return defaultValue;
  const keys = Array.isArray(path) ? path : path.split('.');
  let result = obj;
  for (const key of keys) {
    if (result == null) return defaultValue;
    result = result[key];
  }
  return result === undefined ? defaultValue : result;
}

export function set(obj: any, path: string | string[], value: unknown): any {
  if (!obj) return obj;
  const keys = Array.isArray(path) ? path : path.split('.');
  const lastKey = keys.pop();
  if (!lastKey) return obj;
  
  let current = obj;
  for (const key of keys) {
    if (!(key in current) || !isPlainObject(current[key])) {
      current[key] = {};
    }
    current = current[key];
  }
  current[lastKey] = value;
  return obj;
}

export function update(obj: any, path: string | string[], updater: (value: unknown) => unknown): any {
  const current = get(obj, path);
  return set(obj, path, updater(current));
}

export function del(obj: any, path: string | string[]): any {
  if (!obj) return obj;
  const keys = Array.isArray(path) ? path : path.split('.');
  const lastKey = keys.pop();
  if (!lastKey) return obj;
  
  let current = obj;
  for (const key of keys) {
    if (!(key in current) || !isPlainObject(current[key])) {
      return obj;
    }
    current = current[key];
  }
  delete current[lastKey];
  return obj;
}

export function has(obj: any, path: string | string[]): boolean {
  return get(obj, path) !== undefined;
}

export function hasPath(obj: any, path: string | string[]): boolean {
  return has(obj, path);
}

export function flattenKeys(obj: object, prefix: string = ''): Record<string, unknown> {
  if (!obj) return {};
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      const value = (obj as any)[key];
      if (isPlainObject(value)) {
        Object.assign(result, flattenKeys(value, newKey));
      } else {
        result[newKey] = value;
      }
    }
  }
  return result;
}

export function unflattenKeys(flatObj: Record<string, unknown>): object {
  if (!flatObj) return {};
  const result: any = {};
  for (const key in flatObj) {
    if (Object.prototype.hasOwnProperty.call(flatObj, key)) {
      set(result, key, (flatObj as any)[key]);
    }
  }
  return result;
}

export function flattenObject(obj: object): Record<string, unknown> {
  return flattenKeys(obj);
}

export function unflattenObject(flatObj: Record<string, unknown>): object {
  return unflattenKeys(flatObj);
}

export function uniqBy<T>(arr: T[], key: keyof T | ((item: T) => unknown)): T[] {
  if (!arr) return [];
  const seen = new Set();
  const getKey = typeof key === 'function' ? key : (item: T) => item[key];
  return arr.filter(item => {
    const k = getKey(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function uniq<T>(arr: T[]): T[] {
  return uniqBy(arr, (item) => item);
}

export function groupByKey<T>(arr: T[], key: keyof T | ((item: T) => string | number)): Record<string, T[]> {
  if (!arr) return {};
  const getKey = typeof key === 'function' ? key : (item: T) => String(item[key]);
  return arr.reduce((result, item) => {
    const k = getKey(item);
    if (!result[k]) result[k] = [];
    result[k].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

export function sortKeys<T extends object>(obj: T): T {
  if (!obj) return obj;
  const sorted: any = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    sorted[key] = (obj as any)[key];
  }
  return sorted as T;
}

export function mapValues<T extends object, U>(obj: T, fn: (value: T[keyof T], key: keyof T) => U): Record<keyof T, U> {
  if (!obj) return {} as Record<keyof T, U>;
  const result = {} as Record<keyof T, U>;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = fn(obj[key], key);
    }
  }
  return result;
}

export function mapKeys<T extends object, K extends string>(obj: T, fn: (key: keyof T, value: T[keyof T]) => K): Record<K, T[keyof T]> {
  if (!obj) return {} as Record<K, T[keyof T]>;
  const result = {} as Record<K, T[keyof T]>;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[fn(key, obj[key])] = obj[key];
    }
  }
  return result;
}

export function forEach<T extends object>(obj: T, fn: (value: T[keyof T], key: keyof T) => void): void {
  if (!obj) return;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      fn(obj[key], key);
    }
  }
}

export function forEachDeep(obj: any, fn: (value: unknown, key: string | number, path: string) => void, path: string = ''): void {
  if (!obj) return;
  if (isPlainObject(obj)) {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const newPath = path ? `${path}.${key}` : String(key);
        fn(obj[key], key, newPath);
        if (isPlainObject(obj[key]) || Array.isArray(obj[key])) {
          forEachDeep(obj[key], fn, newPath);
        }
      }
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const newPath = `${path}[${index}]`;
      fn(item, index, newPath);
      if (isPlainObject(item) || Array.isArray(item)) {
        forEachDeep(item, fn, newPath);
      }
    });
  }
}

export function filterValues<T extends object>(obj: T, predicate: (value: T[keyof T], key: keyof T) => boolean): Partial<T> {
  if (!obj) return {};
  const result: Partial<T> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && predicate(obj[key], key)) {
      result[key] = obj[key];
    }
  }
  return result;
}

export function filterKeys<T extends object>(obj: T, predicate: (key: keyof T) => boolean): Partial<T> {
  if (!obj) return {};
  const result: Partial<T> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && predicate(key)) {
      result[key] = obj[key];
    }
  }
  return result;
}

export function reduce<T extends object, U>(obj: T, fn: (acc: U, value: T[keyof T], key: keyof T) => U, initial: U): U {
  if (!obj) return initial;
  let acc = initial;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      acc = fn(acc, obj[key], key);
    }
  }
  return acc;
}

export function reduceRight<T extends object, U>(obj: T, fn: (acc: U, value: T[keyof T], key: keyof T) => U, initial: U): U {
  if (!obj) return initial;
  const keys = Object.keys(obj).reverse();
  let acc = initial;
  for (const key of keys) {
    acc = fn(acc, obj[key], key as keyof T);
  }
  return acc;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function isEmptyObject(value: unknown): boolean {
  return isPlainObject(value) && Object.keys(value as object).length === 0;
}

export function isObject(value: unknown): value is object {
  return value !== null && typeof value === 'object';
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}

export function isAsyncFunction(value: unknown): value is (...args: unknown[]) => Promise<unknown> {
  return isFunction(value) && (value as any)[Symbol.toStringTag] === 'AsyncFunction';
}

export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
  return value instanceof Promise || (isObject(value) && isFunction((value as any).then));
}

export function isNull(value: unknown): value is null {
  return value === null;
}

export function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

export function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

export function isRegExp(value: unknown): value is RegExp {
  return value instanceof RegExp;
}

export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

export function isBuffer(value: unknown): boolean {
  if (typeof Buffer === 'undefined') return false;
  return Buffer.isBuffer(value);
}

export function isMap(value: unknown): value is Map<unknown, unknown> {
  return value instanceof Map;
}

export function isSet(value: unknown): value is Set<unknown> {
  return value instanceof Set;
}

export function isSymbol(value: unknown): value is symbol {
  return typeof value === 'symbol';
}

export function isPrimitive(value: unknown): boolean {
  return value === null || (typeof value !== 'object' && typeof value !== 'function');
}

export function isIterable(value: unknown): value is Iterable<unknown> {
  return isObject(value) && isFunction((value as any)[Symbol.iterator]);
}

export function isArrayLike(value: unknown): boolean {
  return isArray(value) || (isObject(value) && isNumber((value as any).length));
}

export function isLength(value: unknown): boolean {
  return isNumber(value) && value >= 0 && Number.isInteger(value);
}

export function isEmpty(value: unknown): boolean {
  if (isNil(value)) return true;
  if (isString(value) || isArray(value)) return value.length === 0;
  if (isMap(value) || isSet(value)) return value.size === 0;
  if (isPlainObject(value)) return Object.keys(value).length === 0;
  return false;
}

export function getType(value: unknown): string {
  return Object.prototype.toString.call(value).slice(8, -1);
}

export function getTypeName(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  const type = typeof value;
  if (type === 'object') {
    if (value.constructor) return value.constructor.name;
    return 'Object';
  }
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function safeStringify(value: unknown, space?: number): string {
  const cache = new WeakSet();
  return JSON.stringify(value, (key, val) => {
    if (typeof val === 'object' && val !== null) {
      if (cache.has(val)) return '[Circular]';
      cache.add(val);
    }
    return val;
  }, space);
}

export function safeParse<T = unknown>(str: string, defaultValue?: T): T | undefined {
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}

export function freeze<T>(obj: T): Readonly<T> {
  return Object.freeze(obj);
}

export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      deepFreeze((obj as any)[key]);
    }
  }
  return obj;
}

export function seal<T>(obj: T): T {
  return Object.seal(obj);
}

export function deepSeal<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.seal(obj);
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      deepSeal((obj as any)[key]);
    }
  }
  return obj;
}

export function isFrozen(obj: unknown): boolean {
  return Object.isFrozen(obj);
}

export function isSealed(obj: unknown): boolean {
  return Object.isSealed(obj);
}

export function merge<T extends object>(target: T, ...sources: Partial<T>[]): T {
  return deepMerge(target, ...sources);
}

export function mergeAll<T extends object>(target: T, sources: Partial<T>[]): T {
  return deepMerge(target, ...sources);
}

export function defaults<T extends object>(target: T, ...sources: Partial<T>[]): T {
  const result = { ...target };
  for (const source of sources) {
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key) && result[key] === undefined) {
        result[key] = (source as any)[key];
      }
    }
  }
  return result as T;
}

export function defaultsDeep<T extends object>(target: T, ...sources: Partial<T>[]): T {
  const result = deepClone(target);
  for (const source of sources) {
    const sourceClone = deepClone(source);
    for (const key in sourceClone) {
      if (Object.prototype.hasOwnProperty.call(sourceClone, key)) {
        if (result[key] === undefined) {
          result[key] = sourceClone[key];
        } else if (isPlainObject(result[key]) && isPlainObject(sourceClone[key])) {
          result[key] = defaultsDeep(result[key], sourceClone[key]);
        }
      }
    }
  }
  return result;
}

export function cloneDeep<T>(obj: T): T {
  return deepClone(obj);
}

export function equals<T>(obj1: T, obj2: T): boolean {
  return deepEqual(obj1, obj2);
}

export function equalsAny<T>(obj: T, ...values: T[]): boolean {
  return values.some(value => deepEqual(obj, value));
}

export function equalsAll<T>(obj: T, ...values: T[]): boolean {
  return values.every(value => deepEqual(obj, value));
}

export function createObject<T extends object>(props: T): T {
  return { ...props };
}

export function fromEntries<T>(entries: Iterable<[string, T]>): Record<string, T> {
  return Object.fromEntries(entries);
}

export function toEntries<T>(obj: Record<string, T>): [string, T][] {
  return Object.entries(obj);
}

export function invert<T extends Record<string, string | number>>(obj: T): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key in obj) {
    result[String(obj[key])] = key;
  }
  return result;
}

export function invertBy<T extends Record<string, string | number>>(obj: T): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const key in obj) {
    const value = String(obj[key]);
    if (!result[value]) result[value] = [];
    result[value].push(key);
  }
  return result;
}

export function countBy<T>(arr: T[], fn: ((item: T) => string | number) | keyof T): Record<string, number> {
  if (!arr) return {};
  const getKey = typeof fn === 'function' ? fn : (item: T) => String((item as any)[fn]);
  return arr.reduce((result, item) => {
    const key = getKey(item);
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {} as Record<string, number>);
}

export function every<T>(arr: T[], predicate: ((item: T) => boolean) | T): boolean {
  if (!arr) return true;
  const isFn = typeof predicate === 'function';
  return arr.every(item => isFn ? (predicate as (item: T) => boolean)(item) : item === predicate);
}

export function some<T>(arr: T[], predicate: ((item: T) => boolean) | T): boolean {
  if (!arr) return false;
  const isFn = typeof predicate === 'function';
  return arr.some(item => isFn ? (predicate as (item: T) => boolean)(item) : item === predicate);
}

export function none<T>(arr: T[], predicate: ((item: T) => boolean) | T): boolean {
  return !some(arr, predicate);
}

export function partitionBy<T>(arr: T[], fn: (item: T) => string | number): Record<string, T[]> {
  if (!arr) return {};
  return arr.reduce((result, item) => {
    const key = String(fn(item));
    if (!result[key]) result[key] = [];
    result[key].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

export function uniqueByKey<T extends object>(arr: T[], key: keyof T | ((item: T) => unknown)): T[] {
  return uniqBy(arr, key);
}
