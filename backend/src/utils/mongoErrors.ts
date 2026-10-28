// MongoDB answers with code 11000 when a unique index is broken (for example, the same e-mail twice).
export function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 11000;
}
