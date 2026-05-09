/**
 * Petit helper pour gérer les jointures Supabase qui peuvent renvoyer
 * un objet ou un tableau selon la cardinalité réelle de la relation.
 */
export function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}
