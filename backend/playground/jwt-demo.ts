import jwt from 'jsonwebtoken';

const SECRET = 'meri-practice-secret-jo-kam-az-kam-32-characters-ki-hai';

// 1. Token banana (sign)
const token = jwt.sign({ sub: 'user123', role: 'admin' }, SECRET, { algorithm: 'HS256', expiresIn: 60 });
console.log('TOKEN:', token);

// 2. Teen hisse: header.payload.signature
const [header, payload, signature] = token.split('.');
console.log('HEADER:', Buffer.from(header!, 'base64url').toString());
console.log('PAYLOAD:', Buffer.from(payload!, 'base64url').toString());
console.log('SIGNATURE:', signature);

// 3. Verify: sahi secret ke saath
const data = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
console.log('VERIFIED:', data);

// 4. Ghalat secret
try {
  jwt.verify(token, 'koi-aur-secret', { algorithms: ['HS256'] });
} catch (err) {
  console.log('GHALAT SECRET:', (err as Error).message);
}

// 5. Kisi ne payload badal diya
const fakePayload = Buffer.from(JSON.stringify({ sub: 'user123', role: 'super_admin' })).toString(
  'base64url',
);
const tampered = `${header}.${fakePayload}.${signature}`;
try {
  jwt.verify(tampered, SECRET, { algorithms: ['HS256'] });
} catch (err) {
  console.log('BADLA HUA TOKEN:', (err as Error).message);
}

// 6. Expire ho chuka token
const old = jwt.sign({ sub: 'user123' }, SECRET, { expiresIn: -10 });
try {
  jwt.verify(old, SECRET, { algorithms: ['HS256'] });
} catch (err) {
  console.log('EXPIRED:', err instanceof jwt.TokenExpiredError, (err as Error).message);
}

// 7. decode: bina secret ke parhna (koi bhi kar sakta hai)
console.log('DECODE:', jwt.decode(token));
