/**
 * Small, dependency-free unique id generator. Good enough for local row ids
 * (timestamp prefix keeps them roughly sortable; random suffix avoids clashes).
 */
export function newId(prefix = ''): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}${ts}${rand}`;
}

export function now(): number {
  return Date.now();
}
