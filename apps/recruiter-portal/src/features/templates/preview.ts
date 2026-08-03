import type { MessageTemplate } from './message-template';
import { FILLABLE } from './placeholders';

const PLACEHOLDER = /\{\{([^{}]*)\}\}/g;

export type PlaceholderValues = Record<string, string>;

export interface MessagePreview {
  subject: string;
  body: string;
}

/** The API resolves these only at send, so a preview has to fill them here. A name outside the
 * Placeholder vocabulary is left as written rather than blanked: the words the API refuses to
 * fill are the words it would send, and hiding them would make the preview a lie. */
function fill(text: string, values: PlaceholderValues): string {
  return text.replace(PLACEHOLDER, (written, name: string) => {
    const trimmed = name.trim();
    return FILLABLE.includes(trimmed) ? (values[trimmed] ?? written) : written;
  });
}

export function messagePreview(
  template: MessageTemplate,
  values: PlaceholderValues,
): MessagePreview {
  return { subject: fill(template.subject, values), body: fill(template.body, values) };
}

export function paragraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '');
}
