import { z } from 'zod';
import { SCOPE_LABELS, TAG_SCOPES, type Tag, tagNamed } from '../tag';

const name = z
  .string()
  .trim()
  .min(1, 'Name the Tag.')
  .max(200, 'Keep the name to 200 characters or fewer.');

function takenName(vocabulary: Tag[], except?: string) {
  return (values: { name: string; scope: Tag['scope'] }, ctx: z.RefinementCtx) => {
    const held = tagNamed(vocabulary, { name: values.name, scope: values.scope, except });
    if (!held) return;

    ctx.addIssue({
      code: 'custom',
      path: ['name'],
      message: `Your Tenant already files ${SCOPE_LABELS[held.scope]} under “${held.name}”.`,
    });
  };
}

export function tagFormSchema(vocabulary: Tag[], tag?: Tag) {
  return z.object({ name, scope: z.enum(TAG_SCOPES) }).superRefine(takenName(vocabulary, tag?.id));
}

export type TagFormValues = z.infer<ReturnType<typeof tagFormSchema>>;
