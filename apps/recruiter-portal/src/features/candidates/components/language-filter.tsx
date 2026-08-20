import { Label } from '@sync/ui/components/ui/label';
import { useId } from 'react';
import { ChoiceSelect } from '@/features/jobs/components/choice-select';
import { ReferencePicker } from '@/features/reference/components/reference-picker';
import { useLanguages } from '@/features/reference/hooks/use-languages';
import { languageOptions } from '@/features/reference/options';
import { type LanguageProficiency, PROFICIENCY_ORDER, type SpokenLanguage } from '../reading';

const ANY_LEVEL = 'Any level';

const LEVEL_WORDS: Record<LanguageProficiency, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  fluent: 'Fluent',
  native: 'Native',
};

const LEVELS: Record<string, string> = {
  '': ANY_LEVEL,
  ...Object.fromEntries(PROFICIENCY_ORDER.map((level) => [level, LEVEL_WORDS[level]])),
};

interface LanguageFilterProps {
  id: string;
  value: SpokenLanguage[];
  onChange: (value: SpokenLanguage[]) => void;
  onBlur: () => void;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

export function LanguageFilter({ id, value, onChange, onBlur, ...aria }: LanguageFilterProps) {
  const languages = useLanguages();
  const levelId = useId();

  const named = (code: string) =>
    languages.data?.find((language) => language.code === code)?.name ?? code;

  return (
    <div className="space-y-2">
      <ReferencePicker
        multiple
        id={id}
        noun="language"
        list={languages}
        options={languageOptions(languages.data)}
        value={value.map((language) => language.code)}
        onChange={(codes) =>
          onChange(
            codes.map(
              (code) => value.find((language) => language.code === code) ?? { code, level: '' },
            ),
          )
        }
        onBlur={onBlur}
        aria-describedby={aria['aria-describedby']}
        aria-invalid={aria['aria-invalid']}
      />

      {value.map((language, at) => (
        <div key={language.code} className="flex items-center gap-2 pl-1">
          <Label htmlFor={`${levelId}-${language.code}`} className="min-w-24 text-meta">
            {named(language.code)} at least
          </Label>
          <ChoiceSelect
            field={{
              id: `${levelId}-${language.code}`,
              name: `language-level-${language.code}`,
              value: language.level,
              onBlur,
              onChange: (level) =>
                onChange(value.map((each, index) => (index === at ? { ...each, level } : each))),
            }}
            items={LEVELS}
          />
        </div>
      ))}
    </div>
  );
}
