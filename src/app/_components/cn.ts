/** Joins truthy class names with a space. Not a component - a tiny shared helper. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
