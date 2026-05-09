/**
 * @fileOverview 通用工具函数 - 提供异步处理、函数式编程、验证等通用工具
 * @module utils/common
 */

export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function timeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage?: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(errorMessage || `Operation timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeoutPromise]);
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    exponential?: boolean;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts || 3;
  const baseDelay = options.delay || 1000;
  const exponential = options.exponential !== false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      const delayTime = exponential ? baseDelay * Math.pow(2, attempt - 1) : baseDelay;
      if (options.onRetry) options.onRetry(attempt, error as Error);
      await delay(delayTime);
    }
  }
  throw new Error('Retry failed');
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    jitter?: boolean;
  } = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts || 3;
  const initialDelay = options.initialDelay || 1000;
  const maxDelay = options.maxDelay || 30000;
  const backoffFactor = options.backoffFactor || 2;
  const jitter = options.jitter !== false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      let delayTime = Math.min(initialDelay * Math.pow(backoffFactor, attempt - 1), maxDelay);
      if (jitter) delayTime = delayTime * (0.5 + Math.random() * 0.5);
      await delay(delayTime);
    }
  }
  throw new Error('Retry with backoff failed');
}

export function memoize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map<string, ReturnType<T>>();
  return ((...args: any[]) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

export function memoizeAsync<T extends (...args: any[]) => Promise<any>>(fn: T): T {
  const cache = new Map<string, Promise<ReturnType<T>>>();
  return ((...args: any[]) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key)!;
    const promise = fn(...args);
    cache.set(key, promise);
    return promise;
  }) as T;
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let lastTime = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastTime >= wait) {
      lastTime = now;
      fn(...args);
    }
  };
}

export function once<T extends (...args: any[]) => any>(fn: T): T {
  let called = false;
  let result: ReturnType<T>;
  return ((...args: any[]) => {
    if (!called) {
      called = true;
      result = fn(...args);
    }
    return result;
  }) as T;
}

export function after<T extends (...args: any[]) => any>(fn: T, count: number): T {
  let counter = 0;
  return ((...args: any[]) => {
    counter++;
    if (counter >= count) {
      return fn(...args);
    }
  }) as T;
}

export function before<T extends (...args: any[]) => any>(fn: T, count: number): T {
  let counter = 0;
  return ((...args: any[]) => {
    counter++;
    if (counter < count) {
      return fn(...args);
    }
  }) as T;
}

export function compose<T>(...fns: Array<(arg: T) => T>): (arg: T) => T {
  return (arg: T) => fns.reduceRight((acc, fn) => fn(acc), arg);
}

export function pipe<T>(...fns: Array<(arg: T) => T>): (arg: T) => T {
  return (arg: T) => fns.reduce((acc, fn) => fn(acc), arg);
}

export function curry(fn: Function): Function {
  return function curried(...args: any[]) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    }
    return function(...args2: any[]) {
      return curried.apply(this, args.concat(args2));
    };
  };
}

export function curryRight(fn: Function): Function {
  return function curried(...args: any[]) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    }
    return function(...args2: any[]) {
      return curried.apply(this, args2.concat(args));
    };
  };
}

export function partial(fn: Function, ...presetArgs: any[]): Function {
  return function(...laterArgs: any[]) {
    return fn.apply(this, presetArgs.concat(laterArgs));
  };
}

export function partialRight(fn: Function, ...presetArgs: any[]): Function {
  return function(...laterArgs: any[]) {
    return fn.apply(this, laterArgs.concat(presetArgs));
  };
}

export function bind<T extends (...args: any[]) => any>(
  fn: T,
  thisArg: any,
  ...presetArgs: any[]
): (...args: any[]) => ReturnType<T> {
  return function(...args: any[]) {
    return fn.apply(thisArg, presetArgs.concat(args));
  } as T;
}

export function call<T>(fn: (...args: any[]) => T, thisArg: any, ...args: any[]): T {
  return fn.apply(thisArg, args);
}

export function apply<T>(fn: (...args: any[]) => T, thisArg: any, args: any[]): T {
  return fn.apply(thisArg, args);
}

export function invoke<T>(obj: any, methodName: string, ...args: any[]): T {
  return obj[methodName].apply(obj, args);
}

export function invokeMap<T>(
  coll: any[],
  methodName: string,
  ...args: any[]
): T[] {
  return coll.map(item => item[methodName].apply(item, args));
}

export function over<T>(...fns: Array<(...args: any[]) => T>): (...args: any[]) => T[] {
  return (...args: any[]) => fns.map(fn => fn.apply(null, args));
}

export function overArgs<T extends (...args: any[]) => any>(
  fn: T,
  transformers: Array<(arg: any) => any>
): (...args: any[]) => ReturnType<T> {
  return (...args: any[]) => {
    const transformedArgs = args.map((arg, i) =>
      transformers[i] ? transformers[i](arg) : arg
    );
    return fn(...transformedArgs);
  };
}

export function flip<T extends (...args: any[]) => any>(fn: T): (...args: any[]) => ReturnType<T> {
  return (...args: any[]) => fn(...args.reverse());
}

export function negate<T extends (...args: any[]) => boolean>(fn: T): (...args: Parameters<T>) => boolean {
  return (...args: Parameters<T>) => !fn(...args);
}

export function conformsTo<T extends object>(
  obj: T,
  source: { [K in keyof T]?: (value: T[K]) => boolean }
): boolean {
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      if (!source[key]!(obj[key])) return false;
    }
  }
  return true;
}

export function constant<T>(value: T): () => T {
  return () => value;
}

export function identity<T>(value: T): T {
  return value;
}

export function noop(): void {
  return undefined;
}

export function always<T>(value: T): () => T {
  return () => value;
}

export function tap<T>(value: T, fn: (value: T) => void): T {
  fn(value);
  return value;
}

export function intercept<T extends object>(
  obj: T,
  property: keyof T,
  interceptor: (value: T[keyof T]) => T[keyof T]
): T {
  const descriptor = Object.getOwnPropertyDescriptor(obj, property);
  if (!descriptor) return obj;
  Object.defineProperty(obj, property, {
    ...descriptor,
    get: () => interceptor(descriptor.get!()),
  });
  return obj;
}

export function flow<T>(...fns: Array<(...args: any[]) => any>): (...args: any[]) => T {
  return (...args: any[]) => {
    let result = fns[0](...args);
    for (let i = 1; i < fns.length; i++) {
      result = fns[i](result);
    }
    return result;
  };
}

export function flowRight<T>(...fns: Array<(...args: any[]) => any>): (...args: any[]) => T {
  return flow(...fns.reverse());
}

export async function pipeAsync<T>(...fns: Array<(arg: T) => Promise<T>>): Promise<(arg: T) => Promise<T>> {
  return async (arg: T) => {
    let result = await fns[0](arg);
    for (let i = 1; i < fns.length; i++) {
      result = await fns[i](result);
    }
    return result;
  };
}

export async function composeAsync<T>(...fns: Array<(arg: T) => Promise<T>>): Promise<(arg: T) => Promise<T>> {
  return pipeAsync(...fns.reverse());
}

export function sleep(ms: number): Promise<void> {
  return delay(ms);
}

export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<boolean> {
  const timeoutMs = options.timeout || 30000;
  const intervalMs = options.interval || 100;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const result = await Promise.resolve(condition());
    if (result) return true;
    await delay(intervalMs);
  }
  return false;
}

export async function waitUntil(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const result = await waitFor(condition, options);
  if (!result) {
    throw new Error('Condition not met within timeout');
  }
}

export function polled<T>(
  fn: () => T,
  interval: number
): { start: () => void; stop: () => void; isRunning: () => boolean } {
  let intervalId: ReturnType<typeof setInterval> | undefined;
  let running = false;

  return {
    start: () => {
      if (running) return;
      running = true;
      fn();
      intervalId = setInterval(fn, interval);
    },
    stop: () => {
      running = false;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    },
    isRunning: () => running,
  };
}

export class Deferred<T> {
  promise: Promise<T>;
  resolve!: (value: T) => void;
  reject!: (error: Error) => void;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

export function deferred<T>(): Deferred<T> {
  return new Deferred<T>();
}

export function promise<T>(fn: (resolve: (value: T) => void, reject: (error: Error) => void) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    fn(resolve, reject);
  });
}

export function callbackify<T>(fn: (...args: any[]) => Promise<T>): (...args: any[], callback?: (error?: Error, result?: T) => void) => void {
  return (...args: any[]) => {
    const callback = args.pop();
    if (typeof callback === 'function') {
      fn(...args)
        .then(result => callback(undefined, result))
        .catch(error => callback(error));
    } else {
      args.push(callback);
      fn(...args);
    }
  };
}

export function asyncify(fn: (callback: (error?: Error, result?: any) => void) => void): (...args: any[]) => Promise<any> {
  return (...args: any[]) => {
    return new Promise((resolve, reject) => {
      fn(...args, (error: Error | undefined, result: any) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  };
}

export function safewrap<T extends (...args: any[]) => any>(fn: T): (...args: Parameters<T>) => ReturnType<T> {
  return (...args: Parameters<T>) => {
    try {
      return fn(...args);
    } catch (error) {
      return undefined as any;
    }
  };
}

export async function limit<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const p = task().then(result => {
      results.push(result);
    });
    executing.push(p);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex(e => e === p),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

export async function parallel<T>(
  tasks: Array<() => Promise<T>>
): Promise<T[]> {
  return Promise.all(tasks.map(task => task()));
}

export async function serial<T>(
  tasks: Array<() => Promise<T>>
): Promise<T[]> {
  const results: T[] = [];
  for (const task of tasks) {
    results.push(await task());
  }
  return results;
}

export async function waterfall<T>(
  tasks: Array<(result: any) => Promise<T>>
): Promise<T> {
  let result: any;
  for (const task of tasks) {
    result = await task(result);
  }
  return result;
}

export function queue<T>(
  worker: (item: T) => Promise<void>,
  concurrency: number = 1
): {
  add: (item: T) => void;
  addBulk: (items: T[]) => void;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  clear: () => void;
} {
  const items: T[] = [];
  let running = false;
  let paused = false;
  let activeCount = 0;

  const process = async () => {
    if (paused || activeCount >= concurrency || items.length === 0) return;
    
    const item = items.shift();
    if (!item) return;
    
    activeCount++;
    try {
      await worker(item);
    } catch (error) {
      console.error('Queue worker error:', error);
    }
    activeCount--;
    process();
  };

  return {
    add: (item: T) => {
      items.push(item);
      if (running) process();
    },
    addBulk: (newItems: T[]) => {
      items.push(...newItems);
      if (running) process();
    },
    start: async () => {
      running = true;
      const workers = Array(Math.min(concurrency, items.length))
        .fill(null)
        .map(() => process());
      await Promise.all(workers);
    },
    pause: () => { paused = true; },
    resume: () => {
      paused = false;
      process();
    },
    clear: () => { items.length = 0; },
  };
}

export async function batch<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await processor(batch);
    results.push(...batchResults);
  }
  return results;
}

export const chunk = batch;

export function time<T>(fn: () => T): { result: T; duration: number } {
  const start = Date.now();
  const result = fn();
  const duration = Date.now() - start;
  return { result, duration };
}

export async function timeAsync<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  return { result, duration };
}

export function timeEnd(label: string, startTime?: number): number {
  const duration = Date.now() - (startTime || Date.now());
  console.timeEnd?.(label);
  return duration;
}

export function timeStart(label: string): void {
  console.time?.(label);
}

export function measure<T extends (...args: any[]) => any>(fn: T): T {
  return ((...args: any[]) => {
    const start = process.hrtime.bigint();
    const result = fn(...args);
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1e6;
    console.log(`${fn.name} took ${duration}ms`);
    return result;
  }) as T;
}

export function assert(condition: boolean, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected} but got ${actual}`);
  }
}

export function assertStrictEqual<T>(actual: T, expected: T, message?: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(message || `Expected ${expected} but got ${actual}`);
  }
}

export function assertDeepEqual(actual: unknown, expected: unknown, message?: string): void {
  if (!deepEqual(actual, expected)) {
    throw new Error(message || `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

export function assertThrows(fn: () => void, expectedError?: string | RegExp): void {
  try {
    fn();
    throw new Error('Expected function to throw');
  } catch (error) {
    if (expectedError) {
      const errorMessage = (error as Error).message;
      if (typeof expectedError === 'string' && !errorMessage.includes(expectedError)) {
        throw new Error(`Expected error containing "${expectedError}" but got "${errorMessage}"`);
      }
      if (expectedError instanceof RegExp && !expectedError.test(errorMessage)) {
        throw new Error(`Expected error matching ${expectedError} but got "${errorMessage}"`);
      }
    }
  }
}

export async function assertRejects(
  fn: () => Promise<any>,
  expectedError?: string | RegExp
): Promise<void> {
  try {
    await fn();
    throw new Error('Expected function to throw');
  } catch (error) {
    if (expectedError) {
      const errorMessage = (error as Error).message;
      if (typeof expectedError === 'string' && !errorMessage.includes(expectedError)) {
        throw new Error(`Expected error containing "${expectedError}" but got "${errorMessage}"`);
      }
      if (expectedError instanceof RegExp && !expectedError.test(errorMessage)) {
        throw new Error(`Expected error matching ${expectedError} but got "${errorMessage}"`);
      }
    }
  }
}

export function assertDoesNotThrow(fn: () => void, message?: string): void {
  try {
    fn();
  } catch (error) {
    throw new Error(message || `Expected function not to throw but it threw ${(error as Error).message}`);
  }
}

export function expect<T>(value: T): AssertionChain<T> {
  return new AssertionChain(value);
}

export class AssertionChain<T> {
  constructor(private value: T) {}

  toBe(expected: T): this {
    if (this.value !== expected) {
      throw new Error(`Expected ${expected} but got ${this.value}`);
    }
    return this;
  }

  toEqual(expected: unknown): this {
    if (!deepEqual(this.value, expected)) {
      throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(this.value)}`);
    }
    return this;
  }

  toBeTruthy(): this {
    if (!this.value) {
      throw new Error(`Expected truthy value but got ${this.value}`);
    }
    return this;
  }

  toBeFalsy(): this {
    if (this.value) {
      throw new Error(`Expected falsy value but got ${this.value}`);
    }
    return this;
  }

  toBeNull(): this {
    if (this.value !== null) {
      throw new Error(`Expected null but got ${this.value}`);
    }
    return this;
  }

  toBeUndefined(): this {
    if (this.value !== undefined) {
      throw new Error(`Expected undefined but got ${this.value}`);
    }
    return this;
  }

  toContain(item: unknown): this {
    if (Array.isArray(this.value)) {
      if (!this.value.includes(item)) {
        throw new Error(`Expected array to contain ${item}`);
      }
    } else if (typeof this.value === 'string') {
      if (!this.value.includes(String(item))) {
        throw new Error(`Expected string to contain "${item}"`);
      }
    }
    return this;
  }

  toHaveLength(length: number): this {
    if (!this.value || typeof this.value.length !== 'number') {
      throw new Error(`Expected value to have length property`);
    }
    if (this.value.length !== length) {
      throw new Error(`Expected length ${length} but got ${this.value.length}`);
    }
    return this;
  }

  toThrow(error?: string | RegExp): this {
    if (typeof this.value !== 'function') {
      throw new Error('Expected value to be a function');
    }
    try {
      (this.value as Function)();
      throw new Error('Expected function to throw');
    } catch (e) {
      if (error) {
        const errorMessage = (e as Error).message;
        if (typeof error === 'string' && !errorMessage.includes(error)) {
          throw new Error(`Expected error containing "${error}" but got "${errorMessage}"`);
        }
        if (error instanceof RegExp && !error.test(errorMessage)) {
          throw new Error(`Expected error matching ${error} but got "${errorMessage}"`);
        }
      }
    }
    return this;
  }
}

export function expectError<T>(fn: () => T): ErrorAssertionChain {
  return new ErrorAssertionChain(fn);
}

export class ErrorAssertionChain {
  constructor(private fn: () => any) {}

  toThrow(error?: string | RegExp): this {
    try {
      this.fn();
      throw new Error('Expected function to throw but it did not');
    } catch (e) {
      if (error) {
        const errorMessage = (e as Error).message;
        if (typeof error === 'string' && !errorMessage.includes(error)) {
          throw new Error(`Expected error containing "${error}" but got "${errorMessage}"`);
        }
        if (error instanceof RegExp && !error.test(errorMessage)) {
          throw new Error(`Expected error matching ${error} but got "${errorMessage}"`);
        }
      }
    }
    return this;
  }
}

export function expectType<T>(value: unknown, type: string): asserts value is T {
  const actualType = typeof value;
  if (actualType !== type) {
    throw new Error(`Expected type ${type} but got ${actualType}`);
  }
}

export function isValid(value: unknown): boolean {
  return value !== null && value !== undefined && value !== NaN;
}

export function validate(
  value: unknown,
  rules: Array<(value: unknown) => boolean>
): { valid: boolean; failedRule?: number } {
  for (let i = 0; i < rules.length; i++) {
    if (!rules[i](value)) {
      return { valid: false, failedRule: i };
    }
  }
  return { valid: true };
}

export function guard<T>(
  condition: boolean,
  errorFactory: () => Error = () => new Error('Guard failed')
): asserts condition {
  if (!condition) {
    throw errorFactory();
  }
}

export function freezeObject<T extends object>(obj: T): Readonly<T> {
  return Object.freeze(obj);
}

export function sealObject<T extends object>(obj: T): T {
  return Object.seal(obj);
}

export function preventExtensions<T extends object>(obj: T): T {
  Object.preventExtensions(obj);
  return obj;
}

export function getOwnPropertyDescriptors<T extends object>(obj: T): PropertyDescriptorMap {
  return Object.getOwnPropertyDescriptors(obj);
}

export function getOwnPropertyNames<T extends object>(obj: T): Array<keyof T> {
  return Object.getOwnPropertyNames(obj) as Array<keyof T>;
}

export function getOwnPropertySymbols<T extends object>(obj: T): symbol[] {
  return Object.getOwnPropertySymbols(obj);
}

export function getPrototypeOf<T>(obj: T): object | null {
  return Object.getPrototypeOf(obj);
}

export function setPrototypeOf<T extends object>(obj: T, prototype: object | null): T {
  return Object.setPrototypeOf(obj, prototype);
}

export function createProxy<T extends object>(
  target: T,
  handlers: ProxyHandler<T>
): T {
  return new Proxy(target, handlers);
}

export function defineProperty<T extends object>(
  obj: T,
  prop: string | symbol,
  descriptor: PropertyDescriptor
): boolean {
  return Object.defineProperty(obj, prop, descriptor);
}

export function defineProperties<T extends object>(
  obj: T,
  descriptors: PropertyDescriptorMap
): T {
  return Object.defineProperties(obj, descriptors);
}

export function getOwnDescriptor<T extends object>(
  obj: T,
  prop: string | symbol
): PropertyDescriptor | undefined {
  return Object.getOwnPropertyDescriptor(obj, prop);
}

export function setOwnDescriptor<T extends object>(
  obj: T,
  prop: string | symbol,
  descriptor: PropertyDescriptor
): T {
  Object.defineProperty(obj, prop, descriptor);
  return obj;
}

export function deleteProperty<T extends object>(
  obj: T,
  prop: string | symbol
): boolean {
  return delete obj[prop as keyof T];
}

export function hasOwn<T extends object>(obj: T, prop: string | symbol): boolean {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

export function propertyIsEnumerable<T extends object>(
  obj: T,
  prop: string | symbol
): boolean {
  return Object.prototype.propertyIsEnumerable.call(obj, prop);
}

export function toLocaleString<T>(obj: T): string {
  return String(obj);
}

export function toString<T>(obj: T): string {
  return Object.prototype.toString.call(obj);
}

export function valueOf<T>(obj: T): T[keyof T] {
  return (obj as any).valueOf();
}

function deepEqual(obj1: unknown, obj2: unknown): boolean {
  if (obj1 === obj2) return true;
  if (obj1 === null || obj2 === null) return obj1 === obj2;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return obj1 === obj2;

  const keys1 = Object.keys(obj1 as object);
  const keys2 = Object.keys(obj2 as object);
  if (keys1.length !== keys2.length) return false;

  return keys1.every(key =>
    deepEqual((obj1 as any)[key], (obj2 as any)[key])
  );
}
