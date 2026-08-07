import type { MessageTemplate } from './message-template';
import { FILLABLE, PLACEHOLDER } from './placeholders';
import type { MessageWords } from './schemas/message-words';

export type PlaceholderValues = Record<string, string>;

function fill(text: string, values: PlaceholderValues): string {
  return text.replace(PLACEHOLDER, (written, name: string) => {
    const trimmed = name.trim();
    return FILLABLE.includes(trimmed) ? (values[trimmed] ?? written) : written;
  });
}

export function messageDraft(template: MessageTemplate, values: PlaceholderValues): MessageWords {
  return { subject: fill(template.subject, values), body: fill(template.body, values) };
}
