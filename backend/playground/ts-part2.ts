import hello, { APP, shout } from './greet.js';
import type { Shouted } from './greet.js';

// 1. Function: parameters aur return type
function add(a: number, b: number): number {
  return a + b;
}
console.log(add(2, 3));

// 2. Default aur optional parameters
function greet(name: string, greeting = 'Salam', title?: string): string {
  return `${greeting} ${title ?? ''}${name}`;
}
console.log(greet('Umar'), '|', greet('Ali', 'Hello', 'Mr. '));

// 3. Arrow function aur void
const double = (n: number): number => n * 2;
const logMessage = (msg: string): void => {
  console.log('LOG:', msg);
};
logMessage(String(double(21)));

// 4. Array methods: map, filter, find
const emails = [' A@B.com ', 'x@y.com', 'bad-email'];
const clean = emails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@'));
console.log(
  clean,
  clean.find((e) => e.startsWith('x')),
);

// 5. throw, try aur catch
function requirePositive(n: number): number {
  if (n <= 0) throw new Error('Number positive hona chahiye');
  return n;
}
try {
  requirePositive(-5);
} catch (err) {
  console.log('Pakda gaya:', err instanceof Error ? err.message : err);
}

// 6. Class, constructor, extends aur static
class HttpError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }

  static notFound(): HttpError {
    return new HttpError(404, 'Not found');
  }
}
const e404 = HttpError.notFound();
console.log(e404.statusCode, e404.message, e404 instanceof Error);

// 7. Generics <T>
function firstItem<T>(items: T[]): T | undefined {
  return items[0];
}
console.log(firstItem([1, 2, 3]), firstItem(['a', 'b']));

// 8. Non-null assertion (!)
const urls = 'http://a.com,http://b.com'.split(',');
const firstUrl: string = urls[0]!;
console.log(firstUrl);

// 9. Promise, async aur await
function wait(ms: number): Promise<string> {
  return new Promise((resolve) => setTimeout(() => resolve(`${ms}ms baad`), ms));
}

async function main(): Promise<void> {
  console.log('Shuru');
  const result = await wait(500);
  console.log(result);
  const [a, b] = await Promise.all([wait(100), wait(200)]);
  console.log(a, b);
}

// 10. import aur export
const loud: Shouted = shout(APP);
console.log(hello(), loud);

main();
