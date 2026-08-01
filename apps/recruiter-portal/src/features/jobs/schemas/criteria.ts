import type { components } from '@sync/api-client';
import { z } from 'zod';

type JobCriteria = components['schemas']['JobCriteria'];
type JobCriteriaView = components['schemas']['JobCriteriaView'];
type SkillImportance = components['schemas']['SkillImportance'];
type LanguageProficiency = components['schemas']['LanguageProficiency'];
type QuestionType = components['schemas']['ApplicationQuestionType'];

export const MAX_CRITERIA_ENTRIES = 50;

export const IMPORTANCE_LABELS: Record<SkillImportance, string> = {
  required: 'Required',
  preferred: 'Preferred',
  optional: 'Optional',
};

export const PROFICIENCY_LABELS: Record<LanguageProficiency, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  fluent: 'Fluent',
  native: 'Native',
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  yes_no: 'Yes or no',
  short_text: 'Short answer',
};

const importance = Object.keys(IMPORTANCE_LABELS) as [SkillImportance, ...SkillImportance[]];
const proficiency = Object.keys(PROFICIENCY_LABELS) as [
  LanguageProficiency,
  ...LanguageProficiency[],
];
const questionType = Object.keys(QUESTION_TYPE_LABELS) as [QuestionType, ...QuestionType[]];

const line = (message: string) =>
  z.string().trim().min(1, message).max(200, 'Use 200 characters or fewer.');

const optionalDecimal = (maximum: number) =>
  z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^\d+(\.\d)?$/.test(value),
      'Use a number with at most one decimal place.',
    )
    .refine((value) => value === '' || Number(value) <= maximum, `Enter ${maximum} or less.`);

const optionalInteger = z
  .string()
  .trim()
  .refine((value) => value === '' || /^\d+$/.test(value), 'Enter a whole number of years.')
  .refine((value) => value === '' || Number(value) <= 99, 'Enter 99 or less.');

const skill = z.object({
  name: line('Enter the skill.'),
  importance: z.enum(importance),
  minimumYears: optionalInteger,
});

const language = z.object({
  code: z.string().trim().min(2, 'Enter a language code.').max(8, 'Use 8 characters or fewer.'),
  minimumProficiency: z.enum(proficiency),
});

const question = z.object({
  questionText: line('Enter the question.'),
  questionType: z.enum(questionType),
  isRequired: z.boolean(),
  acceptedAnswer: z.enum(['', 'yes', 'no']),
});

export const criteriaFormSchema = z
  .object({
    minimumTotalExperienceYears: optionalDecimal(999.9),
    skills: z.array(skill).max(MAX_CRITERIA_ENTRIES),
    languages: z.array(language).max(MAX_CRITERIA_ENTRIES),
    questions: z.array(question).max(MAX_CRITERIA_ENTRIES),
  })
  .superRefine((criteria, context) => {
    refuseRepeats(
      criteria.skills.map((entry) => entry.name),
      context,
      'skills',
      'This skill is already listed.',
    );
    refuseRepeats(
      criteria.languages.map((entry) => entry.code),
      context,
      'languages',
      'This language is already listed.',
    );
  });

function refuseRepeats(
  values: string[],
  context: z.RefinementCtx,
  section: 'skills' | 'languages',
  message: string,
) {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value)) {
      context.addIssue({
        code: 'custom',
        path: [section, index, section === 'skills' ? 'name' : 'code'],
        message,
      });
    }
    seen.add(value);
  });
}

export type CriteriaFormValues = z.input<typeof criteriaFormSchema>;
type Entry<Name extends keyof CriteriaFormValues> = CriteriaFormValues[Name] extends (infer Item)[]
  ? Item
  : never;

export const BLANK_SKILL: Entry<'skills'> = {
  name: '',
  importance: 'preferred',
  minimumYears: '',
};

export const BLANK_LANGUAGE: Entry<'languages'> = {
  code: '',
  minimumProficiency: 'intermediate',
};

export const BLANK_QUESTION: Entry<'questions'> = {
  questionText: '',
  questionType: 'yes_no',
  isRequired: true,
  acceptedAnswer: '',
};

const fieldValue = (value: number | null | undefined) =>
  value === null || value === undefined ? '' : String(value);

export function toCriteriaFormValues(criteria: JobCriteriaView): CriteriaFormValues {
  return {
    minimumTotalExperienceYears: fieldValue(criteria.minimum_total_experience_years),
    skills: criteria.skills.map((entry) => ({
      name: entry.name,
      importance: entry.importance,
      minimumYears: fieldValue(entry.minimum_years),
    })),
    languages: criteria.languages.map((entry) => ({
      code: entry.code,
      minimumProficiency: entry.minimum_proficiency,
    })),
    questions: criteria.questions.map((entry) => ({
      questionText: entry.question_text,
      questionType: entry.question_type,
      isRequired: entry.is_required,
      acceptedAnswer:
        entry.accepted_boolean_answer === null || entry.accepted_boolean_answer === undefined
          ? ''
          : entry.accepted_boolean_answer
            ? 'yes'
            : 'no',
    })),
  };
}

export function toCriteria(values: CriteriaFormValues): JobCriteria {
  const parsed = criteriaFormSchema.parse(values);
  return {
    minimum_total_experience_years:
      parsed.minimumTotalExperienceYears === '' ? null : Number(parsed.minimumTotalExperienceYears),
    skills: parsed.skills.map((entry) => ({
      name: entry.name,
      importance: entry.importance,
      minimum_years: entry.minimumYears === '' ? null : Number(entry.minimumYears),
    })),
    languages: parsed.languages.map((entry) => ({
      code: entry.code,
      minimum_proficiency: entry.minimumProficiency,
    })),
    questions: parsed.questions.map((entry) => ({
      question_text: entry.questionText,
      question_type: entry.questionType,
      is_required: entry.isRequired,
      accepted_boolean_answer:
        entry.questionType !== 'yes_no' || entry.acceptedAnswer === ''
          ? null
          : entry.acceptedAnswer === 'yes',
    })),
  };
}
