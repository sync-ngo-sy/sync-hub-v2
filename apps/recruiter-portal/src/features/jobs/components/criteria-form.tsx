import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@sync/ui/components/ui/card';
import { Checkbox } from '@sync/ui/components/ui/checkbox';
import { Input } from '@sync/ui/components/ui/input';
import { CircleAlert, CircleHelp, Languages, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ReferencePicker } from '@/features/reference/components/reference-picker';
import { useCanonicalSkills } from '@/features/reference/hooks/use-canonical-skills';
import { useLanguages } from '@/features/reference/hooks/use-languages';
import { languageOptions, skillGroups } from '@/features/reference/options';
import { problemMessage } from '@/lib/api-problem';
import { useReplaceJobCriteria } from '../hooks/use-job-actions';
import type { Job } from '../job';
import {
  BLANK_LANGUAGE,
  BLANK_QUESTION,
  BLANK_SKILL,
  type CriteriaFormValues,
  criteriaFormSchema,
  IMPORTANCE_LABELS,
  PROFICIENCY_LABELS,
  QUESTION_TYPE_LABELS,
  toCriteria,
  toCriteriaFormValues,
} from '../schemas/criteria';
import { takenElsewhere } from '../taken-elsewhere';
import { ChoiceSelect } from './choice-select';
import { CriteriaEntryList } from './criteria-entry-list';

export function CriteriaForm({ job }: { job: Job }) {
  const replace = useReplaceJobCriteria(job.id);
  const form = useForm<CriteriaFormValues>({
    resolver: zodResolver(criteriaFormSchema),
    defaultValues: toCriteriaFormValues(job.criteria),
  });
  const skills = useFieldArray({ control: form.control, name: 'skills' });
  const languages = useFieldArray({ control: form.control, name: 'languages' });
  const questions = useFieldArray({ control: form.control, name: 'questions' });
  const questionValues = form.watch('questions');
  const skillValues = form.watch('skills');
  const languageValues = form.watch('languages');
  const skillList = useCanonicalSkills();
  const languageList = useLanguages();

  const save = form.handleSubmit(async (values) => {
    try {
      const criteria = await replace.mutateAsync({
        params: { path: { job_id: job.id } },
        body: toCriteria(values),
      });
      form.reset(toCriteriaFormValues(criteria));
      toast.success('Screening criteria replaced');
    } catch (error) {
      form.setError('root', {
        message: problemMessage(error, "This Job's screening criteria couldn't be replaced."),
      });
    }
  });

  return (
    <form onSubmit={save} noValidate className="space-y-5">
      {job.criteria_locked ? (
        <Alert>
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Screening criteria are locked</AlertTitle>
          <AlertDescription>
            This Job already has an Application, so every applicant keeps the same screening bar.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <CircleAlert aria-hidden="true" />
          <AlertTitle>This is a whole-set replacement</AlertTitle>
          <AlertDescription>
            Saving replaces the whole set of screening criteria. Anything you remove or leave out
            will be deleted, not merged with the current set.
          </AlertDescription>
        </Alert>
      )}

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
              disabled={job.criteria_locked}
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
          disabled={job.criteria_locked}
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
          disabled={job.criteria_locked}
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
          disabled={job.criteria_locked}
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

      {form.formState.errors.root?.message ? (
        <Alert>
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Screening criteria not replaced</AlertTitle>
          <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
        </Alert>
      ) : null}

      {job.criteria_locked ? null : (
        <div className="flex justify-end">
          <Button type="submit" disabled={replace.isPending}>
            {replace.isPending ? 'Saving…' : 'Save screening criteria'}
          </Button>
        </div>
      )}
    </form>
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
