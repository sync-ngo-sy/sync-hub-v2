import { FormField } from '@sync/ui/components/form-field';
import { Card, CardContent, CardDescription, CardHeader } from '@sync/ui/components/ui/card';
import { Checkbox } from '@sync/ui/components/ui/checkbox';
import { Input } from '@sync/ui/components/ui/input';
import { CircleHelp, Languages, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { type UseFormReturn, useFieldArray } from 'react-hook-form';
import { ReferencePicker } from '@/features/reference/components/reference-picker';
import { useCanonicalSkills } from '@/features/reference/hooks/use-canonical-skills';
import { useLanguages } from '@/features/reference/hooks/use-languages';
import { languageOptions, skillGroups } from '@/features/reference/options';
import {
  BLANK_LANGUAGE,
  BLANK_QUESTION,
  BLANK_SKILL,
  type CriteriaFormValues,
  IMPORTANCE_LABELS,
  PROFICIENCY_LABELS,
  QUESTION_TYPE_LABELS,
} from '../schemas/criteria';
import { takenElsewhere } from '../taken-elsewhere';
import { ChoiceSelect } from './choice-select';
import { CriteriaEntryList } from './criteria-entry-list';

interface CriteriaFieldsProps {
  form: UseFormReturn<CriteriaFormValues>;
  disabled?: boolean;
}

export function CriteriaFields({ form, disabled = false }: CriteriaFieldsProps) {
  const skills = useFieldArray({ control: form.control, name: 'skills' });
  const languages = useFieldArray({ control: form.control, name: 'languages' });
  const questions = useFieldArray({ control: form.control, name: 'questions' });
  const questionValues = form.watch('questions');
  const skillValues = form.watch('skills');
  const languageValues = form.watch('languages');
  const skillList = useCanonicalSkills();
  const languageList = useLanguages();

  return (
    <>
      <CriteriaSection
        title="Experience"
        description="The minimum total experience an applicant needs across their work history."
      >
        <FormField
          control={form.control}
          name="minimumTotalExperienceYears"
          label="Minimum total experience"
          description="Years, to one decimal. Leave blank for no minimum."
        >
          {(field) => (
            <Input
              {...field}
              value={field.value}
              inputMode="decimal"
              placeholder="3.5"
              disabled={disabled}
            />
          )}
        </FormField>
      </CriteriaSection>

      <CriteriaSection
        title="Skills"
        description="Canonical skills the role asks for, and whether each can disqualify."
      >
        <CriteriaEntryList
          ids={skills.fields.map((field) => field.id)}
          label={(index) => `Skill ${index + 1}`}
          icon={Wrench}
          addLabel="Add a skill"
          empty="No skills screen applicants for this Job."
          disabled={disabled}
          onAdd={() => skills.append(BLANK_SKILL)}
          onRemove={skills.remove}
        >
          {(index) => (
            <div className="grid gap-4 md:grid-cols-[1fr_11rem_9rem]">
              <FormField control={form.control} name={`skills.${index}.name`} label="Skill">
                {({ value, onChange, onBlur, id, ...aria }) => (
                  <ReferencePicker
                    id={id}
                    noun="skill"
                    list={skillList}
                    options={skillGroups(
                      skillList.data,
                      takenElsewhere(skillValues, index, (entry) => entry.name),
                    )}
                    value={value || null}
                    onChange={onChange}
                    onBlur={onBlur}
                    aria-describedby={aria['aria-describedby']}
                    aria-invalid={aria['aria-invalid']}
                  />
                )}
              </FormField>
              <FormField
                control={form.control}
                name={`skills.${index}.importance`}
                label="Importance"
              >
                {(field) => <ChoiceSelect field={field} items={IMPORTANCE_LABELS} />}
              </FormField>
              <FormField
                control={form.control}
                name={`skills.${index}.minimumYears`}
                label="Minimum years"
                description="Optional."
              >
                {(field) => (
                  <Input {...field} value={field.value} inputMode="numeric" placeholder="2" />
                )}
              </FormField>
            </div>
          )}
        </CriteriaEntryList>
      </CriteriaSection>

      <CriteriaSection
        title="Languages"
        description="Languages the applicant needs and the minimum accepted proficiency."
      >
        <CriteriaEntryList
          ids={languages.fields.map((field) => field.id)}
          label={(index) => `Language ${index + 1}`}
          icon={Languages}
          addLabel="Add a language"
          empty="No languages screen applicants for this Job."
          disabled={disabled}
          onAdd={() => languages.append(BLANK_LANGUAGE)}
          onRemove={languages.remove}
        >
          {(index) => (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name={`languages.${index}.code`} label="Language">
                {({ value, onChange, onBlur, id, ...aria }) => (
                  <ReferencePicker
                    id={id}
                    noun="language"
                    list={languageList}
                    options={languageOptions(
                      languageList.data,
                      takenElsewhere(languageValues, index, (entry) => entry.code),
                    )}
                    value={value || null}
                    onChange={onChange}
                    onBlur={onBlur}
                    aria-describedby={aria['aria-describedby']}
                    aria-invalid={aria['aria-invalid']}
                  />
                )}
              </FormField>
              <FormField
                control={form.control}
                name={`languages.${index}.minimumProficiency`}
                label="Minimum proficiency"
              >
                {(field) => <ChoiceSelect field={field} items={PROFICIENCY_LABELS} />}
              </FormField>
            </div>
          )}
        </CriteriaEntryList>
      </CriteriaSection>

      <CriteriaSection
        title="Questions"
        description="Questions applicants answer in this order. A yes-or-no answer can screen them out."
      >
        <CriteriaEntryList
          ids={questions.fields.map((field) => field.id)}
          label={(index) => `Question ${index + 1}`}
          icon={CircleHelp}
          addLabel="Add a question"
          empty="This Job asks no application questions."
          disabled={disabled}
          onAdd={() => questions.append(BLANK_QUESTION)}
          onRemove={questions.remove}
        >
          {(index) => (
            <div className="space-y-4">
              <FormField
                control={form.control}
                name={`questions.${index}.questionText`}
                label="Question"
              >
                {(field) => <Input {...field} value={field.value} />}
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name={`questions.${index}.questionType`}
                  label="Answer type"
                >
                  {(field) => (
                    <ChoiceSelect
                      field={field}
                      items={QUESTION_TYPE_LABELS}
                      onValueChange={(value) => {
                        if (value === null) return;
                        field.onChange(value);
                        if (value !== 'yes_no') {
                          form.setValue(`questions.${index}.acceptedAnswer`, 'none');
                        }
                      }}
                    />
                  )}
                </FormField>
                {questionValues[index]?.questionType === 'yes_no' ? (
                  <FormField
                    control={form.control}
                    name={`questions.${index}.acceptedAnswer`}
                    label="Passing answer"
                    description="No selection means this question does not screen."
                  >
                    {(field) => (
                      <ChoiceSelect
                        field={field}
                        items={{ none: 'Does not screen', yes: 'Yes', no: 'No' }}
                      />
                    )}
                  </FormField>
                ) : null}
              </div>
              <FormField
                control={form.control}
                name={`questions.${index}.isRequired`}
                label="Required to apply"
                orientation="horizontal"
              >
                {({ value, onChange, ...field }) => (
                  <Checkbox {...field} checked={value === true} onCheckedChange={onChange} />
                )}
              </FormField>
            </div>
          )}
        </CriteriaEntryList>
      </CriteriaSection>
    </>
  );
}

function CriteriaSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-h3 text-card-foreground">{title}</h2>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}
