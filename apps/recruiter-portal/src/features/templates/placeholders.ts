export const FILLABLE: readonly string[] = ['candidate_name', 'job_title', 'tenant_name'];

export const PLACEHOLDER = /\{\{([^{}]*)\}\}/g;

function asWritten(name: string): string {
  return `{{ ${name} }}`;
}

export function asList(names: readonly string[]): string {
  const written = names.map(asWritten);
  if (written.length < 2) return written.join('');
  return `${written.slice(0, -1).join(', ')} or ${written.at(-1)}`;
}

function unfillableIn(text: string): string[] {
  const named = [...text.matchAll(PLACEHOLDER)].map((found) => (found[1] ?? '').trim());
  return [...new Set(named.filter((name) => !FILLABLE.includes(name)))];
}

export function unfillableMessage(text: string): string | null {
  const unfillable = unfillableIn(text);
  if (unfillable.length === 0) return null;
  return `Nothing can fill ${asList(unfillable)}. Use ${asList(FILLABLE)}.`;
}
