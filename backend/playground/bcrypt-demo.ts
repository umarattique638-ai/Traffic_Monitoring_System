import bcrypt from 'bcryptjs';

const hash = await bcrypt.hash('secret123', 12);
console.log('HASH:', hash);

console.log('SAHI PASSWORD:', await bcrypt.compare('secret123', hash));
console.log('GHALAT PASSWORD:', await bcrypt.compare('secret124', hash));

const hash2 = await bcrypt.hash('secret123', 12);
console.log('DOOSRA HASH:', hash2);
console.log('DONO BARABAR?', hash === hash2);
