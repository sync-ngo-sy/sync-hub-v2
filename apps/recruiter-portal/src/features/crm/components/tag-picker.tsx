import { Button } from '@sync/ui/components/ui/button';
import { Input } from '@sync/ui/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@sync/ui/components/ui/popover';
import { Check, Plus, Tag as TagIcon } from 'lucide-react';
import { useState } from 'react';
import { type Tag, tagChoices, tagToCreate } from '../tag';

interface TagPickerProps {
  vocabulary: Tag[];
  on: Tag[];
  onToggle: (tagId: string) => void;
  onCreate: (name: string) => void;
}

export function TagPicker({ vocabulary, on, onToggle, onCreate }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const choices = tagChoices(vocabulary, on, query);
  const toCreate = tagToCreate(vocabulary, query);

  function change(next: boolean) {
    setOpen(next);
    if (!next) setQuery('');
  }

  return (
    <Popover open={open} onOpenChange={change}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <TagIcon aria-hidden="true" />
            Add a Tag
          </Button>
        }
      />
      <PopoverContent align="start" className="w-72 p-2">
        <div className="space-y-2">
          <Input
            aria-label="Find or create a Tag"
            placeholder="Find or create a Tag"
            maxLength={200}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <ul aria-label="Tag vocabulary" className="max-h-56 space-y-0.5 overflow-y-auto">
            {choices.map((choice) => (
              <li key={choice.id}>
                <button
                  type="button"
                  aria-pressed={choice.isOn}
                  onClick={() => onToggle(choice.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-dense outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <Check
                    aria-hidden="true"
                    className={choice.isOn ? 'size-4' : 'size-4 text-transparent'}
                  />
                  {choice.name}
                </button>
              </li>
            ))}
          </ul>

          {choices.length === 0 && !toCreate ? (
            <p className="px-2 py-1.5 text-dense text-muted-foreground">
              Your team has no Tags for Applications yet. Type a word to make the first one.
            </p>
          ) : null}

          {toCreate ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                onCreate(toCreate);
                setQuery('');
              }}
            >
              <Plus aria-hidden="true" />
              {`Create “${toCreate}”`}
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
