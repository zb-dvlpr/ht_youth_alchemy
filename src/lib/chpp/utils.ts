export function normalizeArray<T>(input?: T | T[]) {
  if (!input) return [] as T[];
  return Array.isArray(input) ? input : [input];
}

export function parseChppDate(dateString?: string) {
  if (!dateString) return null;
  const parsed = new Date(dateString.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
