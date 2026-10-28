// 1. Variables: let aur const
let city = 'Lahore';
city = 'Karachi';
const appName = 'Traffic Monitoring';
console.log(city, appName);

// 2. Basic types
let userName: string = 'Umar';
let age: number = 22;
let isVerified: boolean = false;
let blockedAt: Date | null = null;
console.log(userName, age, isVerified, blockedAt);

// 3. Arrays
const roles: string[] = ['admin', 'super_admin'];
const scores: number[] = [10, 20, 30];
console.log(roles.length, roles[0], scores);

// 4. Object aur type
type Point = { x: number; y: number };
const point: Point = { x: 5, y: 10 };
console.log(point.x + point.y);

// 5. interface, optional (?) aur readonly
interface User {
  readonly id: string;
  name: string;
  email: string;
  phone?: string;
}
const user: User = { id: 'u1', name: 'Umar', email: 'umar@example.com' };
console.log(user.name, user.phone);

// 6. Union (|) aur literal types
type Role = 'admin' | 'super_admin';
let myRole: Role = 'admin';
let idOrNumber: string | number = 42;
idOrNumber = 'abc';
console.log(myRole, idOrNumber);

// 7. as const aur typeof
const STATUSES = ['active', 'blocked'] as const;
type Status = (typeof STATUSES)[number];
const status: Status = 'blocked';
console.log(status);

// 8. Record aur unknown
const counts: Record<string, number> = { admin: 3, super_admin: 1 };
const input: unknown = JSON.parse('{"email":"a@b.com"}');
if (typeof input === 'object' && input !== null && 'email' in input) {
  console.log('email mili:', (input as { email: string }).email);
}
console.log(counts.admin);

// 9. Template string, ?? aur ?.
let visitor: User | null = Math.random() > 2 ? user : null;
const label = `Hello ${user.name}`;
const phone = user.phone ?? 'no phone';
const visitorName = visitor?.name;
console.log(label, phone, visitorName);

// 10. Destructuring aur spread (...)
const { name, email } = user;
const copy = { ...user, name: 'Ali' };
const [first, ...rest] = scores;
console.log(name, email, copy.name, first, rest);
