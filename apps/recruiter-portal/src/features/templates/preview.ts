import type { MessageTemplate } from './message-template';
import { FILLABLE, PLACEHOLDER } from './placeholders';

export type PlaceholderValues = Record<string, string>;

export interface MessagePreview {
  subject: string;
  body: string;
}

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
