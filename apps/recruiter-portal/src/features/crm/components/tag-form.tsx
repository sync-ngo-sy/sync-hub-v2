import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { DialogFooter } from '@sync/ui/components/ui/dialog';
import { Input } from '@sync/ui/components/ui/input';
import { Label } from '@sync/ui/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@sync/ui/components/ui/radio-group';
import { CircleAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { isProblem, problemDetail } from '@/lib/api-problem';
import { useCreateTag, useRenameTag } from '../hooks/use-tag-vocabulary';
import { TAG_NAME_TAKEN_PROBLEM } from '../problems';
import { type TagFormValues, tagFormSchema } from '../schemas/tag';
import { SCOPE_DESCRIPTIONS, SCOPE_LABELS, TAG_SCOPES, type Tag, type TagScope } from '../tag';

interface TagFormProps {
  vocabulary: Tag[];
  tag?: Tag;
  onSaved: () => void;
  onCancel: () => void;
}

export function TagForm({ vocabulary, tag, onSaved, onCancel }: TagFormProps) {
  const create = useCreateTag();
  const rename = useRenameTag();
  const form = useForm<TagFormValues>({
    resolver: zodResolver(tagFormSchema(vocabulary, tag)),
    defaultValues: tag ? { name: tag.name, scope: tag.scope } : { name: '', scope: 'application' },
  });

  const save = form.handleSubmit(async (values) => {
    const name = values.name.trim();

    try {
      if (tag) {
        await rename.mutateAsync({ params: { path: { tag_id: tag.id } }, body: { name } });
        toast.success('Tag renamed');
      } else {
        await create.mutateAsync({ body: { name, scope: values.scope } });
        toast.success('Tag added');
      }
      onSaved();
    } catch (error) {
      const fallback = tag
        ? "That Tag couldn't be renamed. Try again."
        : "That Tag couldn't be added. Try again.";
      const field = isProblem(error, TAG_NAME_TAKEN_PROBLEM) ? 'name' : 'root';
      form.setError(field, { message: problemDetail(error, fallback) });
    }
  });

  const isPending = create.isPending || rename.isPending;

  return (
    <form onSubmit={save} noValidate>
      <div className="space-y-4 py-4">
        <FormField control={form.control} name="name" label="Name">
          {(field) => <Input {...field} value={field.value} autoComplete="off" autoFocus />}
        </FormField>

        {tag ? null : (
          <FormField control={form.control} name="scope" label="Files">
            {({ value, onChange, onBlur, name, ref, id, ...field }) => (
              <RadioGroup
                {...field}
                ref={ref}
                name={name}
                value={value}
                onValueChange={(scope) => onChange(scope as TagScope)}
                onBlur={onBlur}
                aria-label="Files"
              >
                {TAG_SCOPES.map((scope) => (
                  <div key={scope} className="flex items-start gap-2">
                    <RadioGroupItem id={`${id}-${scope}`} value={scope} className="mt-1" />
                    <div className="space-y-0.5">
                      <Label htmlFor={`${id}-${scope}`}>{SCOPE_LABELS[scope]}</Label>
                      <p className="text-meta text-muted-foreground">{SCOPE_DESCRIPTIONS[scope]}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            )}
          </FormField>
        )}
      </div>

      {form.formState.errors.root?.message ? (
        <Alert className="mb-4">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>{tag ? 'Tag not renamed' : 'Tag not added'}</AlertTitle>
          <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
        </Alert>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="ghost" disabled={isPending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (tag ? 'Saving name…' : 'Adding Tag…') : tag ? 'Save name' : 'Add Tag'}
        </Button>
      </DialogFooter>
    </form>
  );
}
