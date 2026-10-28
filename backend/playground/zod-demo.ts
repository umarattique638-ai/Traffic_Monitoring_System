import { z } from 'zod';

const signup = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  age: z.coerce.number().int().min(18).optional(),
});

type Signup = z.infer<typeof signup>;

const ok: Signup = signup.parse({ name: '  Umar ', email: ' UMAR@Example.com ' });
console.log('SAHI:', ok);

const result = signup.safeParse({ name: 'U', email: 'abc', age: '15' });
if (!result.success) {
  console.log(
    'GHALTIYAN:',
    result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
  );
}
