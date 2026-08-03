import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sync/ui/components/ui/dialog';
import { Input } from '@sync/ui/components/ui/input';
import { Label } from '@sync/ui/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@sync/ui/components/ui/radio-group';
import { CircleAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { isProblem, problemDetail } from '@/lib/api-problem';
import { useCreateTag } from '../hooks/use-tag-vocabulary';
import { TAG_NAME_TAKEN_PROBLEM } from '../problems';
import { newTagSchema, type TagFormValues } from '../schemas/tag';
import { SCOPE_DESCRIPTIONS, SCOPE_LABELS, TAG_SCOPES, type Tag, type TagScope } from '../tag';

const EMPTY_TAG: TagFormValues = { name: '', scope: 'application' };

interface AddTagDialogProps {
  vocabulary: Tag[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTagDialog({ vocabulary, open, onOpenChange }: AddTagDialogProps) {
  const create = useCreateTag();
  const form = useForm<TagFormValues>({
    resolver: zodResolver(newTagSchema(vocabulary)),
    defaultValues: EMPTY_TAG,
  });

  const add = form.handleSubmit(async (values) => {
    try {
      await create.mutateAsync({ body: { name: values.name.trim(), scope: values.scope } });
      toast.success('Tag added');
      form.reset(EMPTY_TAG);
      onOpenChange(false);
    } catch (error) {
      // The form has already ruled out the names the vocabulary knew about, so a 409 here is a
      // word a colleague minted in the meantime — it still belongs under the name.
      const field = isProblem(error, TAG_NAME_TAKEN_PROBLEM) ? 'name' : 'root';
      form.setError(field, {
        message: problemDetail(error, "That Tag couldn't be added. Try again."),
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={add} noValidate>
          <DialogHeader>
            <DialogTitle>Add a Tag</DialogTitle>
            <DialogDescription>
              A word your team files by. It is your Tenant's alone, and what it may be put on is
              fixed when you add it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <FormField control={form.control} name="name" label="Name">
              {(field) => <Input {...field} value={field.value} autoComplete="off" autoFocus />}
            </FormField>

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
                        <p className="text-meta text-muted-foreground">
                          {SCOPE_DESCRIPTIONS[scope]}
                        </p>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </FormField>
          </div>

          {form.formState.errors.root?.message ? (
            <Alert className="mb-4">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Tag not added</AlertTitle>
              <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={create.isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Adding Tag…' : 'Add Tag'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
