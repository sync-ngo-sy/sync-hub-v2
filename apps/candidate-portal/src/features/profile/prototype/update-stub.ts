/**
 * PROTOTYPE for #369 — throwaway. The whole `prototype/` folder goes when the question is settled.
 *
 * Question: when a Candidate uploads a new CV, what does the portal ask before it rewrites their
 * profile, and where does taking it back belong?
 *
 * Three variants of the profile editor, switchable with `?variant=`, on the real `/profile` route.
 * This file is the half of the answer that is not a picture — when the question is raised, what
 * happens when nobody answers it, and whether an answer stands for the next upload. Each variant
 * hands in its own Policy and drives this one machine, so the three disagree about the question
 * and never about the state under it.
 *
 * The portal updates a profile from a CV; it does not fill it. `filledFromCv` keeps the old word
 * because it is production code this prototype only reads.
 */

export type Phase = 'idle' | 'uploading' | 'reading' | 'read';

export type Answer = 'update' | 'keep';

export interface Policy {
  askAt: 'upload' | 'landing';
  remembers: boolean;
}

export interface UpdateState {
  phase: Phase;
  cvName: string | null;
  asking: boolean;
  answer: Answer | null;
  remembered: Answer | null;
  updatedBy: string | null;
  firstUpload: boolean;
}

export type UpdateAction =
  | { type: 'upload'; cvName: string }
  | { type: 'reading' }
  | { type: 'read' }
  | { type: 'notification'; cvName: string }
  | { type: 'reply'; answer: Answer }
  | { type: 'dismiss' }
  | { type: 'ask' }
  | { type: 'forget' }
  | { type: 'updated' }
  | { type: 'undo' }
  | { type: 'saved' }
  | { type: 'reset'; firstUpload: boolean };

export function initialUpdate(firstUpload: boolean): UpdateState {
  return {
    phase: 'idle',
    cvName: null,
    asking: false,
    answer: null,
    remembered: null,
    updatedBy: null,
    firstUpload,
  };
}

function standingAnswer(state: UpdateState, policy: Policy): Answer | null {
  if (state.firstUpload) return 'update';
  return policy.remembers ? state.remembered : null;
}

export function reduceUpdate(
  state: UpdateState,
  action: UpdateAction,
  policy: Policy,
): UpdateState {
  switch (action.type) {
    case 'upload': {
      const standing = standingAnswer(state, policy);
      return {
        ...state,
        phase: 'uploading',
        cvName: action.cvName,
        answer: standing,
        asking: standing === null && policy.askAt === 'upload',
      };
    }
    case 'reading':
      return { ...state, phase: 'reading' };
    case 'read':
      if (state.answer !== null) return { ...state, phase: 'read' };
      return { ...state, phase: 'read', asking: policy.askAt === 'landing' || state.asking };
    case 'notification': {
      const standing = standingAnswer(state, policy);
      return {
        ...state,
        phase: 'read',
        cvName: action.cvName,
        answer: standing,
        asking: standing === null,
      };
    }
    case 'reply':
      return {
        ...state,
        asking: false,
        answer: action.answer,
        remembered: policy.remembers ? action.answer : state.remembered,
      };
    case 'dismiss':
      return { ...state, asking: false, answer: 'keep' };
    case 'ask':
      return { ...state, asking: true };
    case 'forget':
      return { ...state, remembered: null };
    case 'updated':
      return { ...state, updatedBy: state.cvName };
    case 'undo':
      return { ...state, updatedBy: null, answer: 'keep' };
    case 'saved':
      return { ...state, updatedBy: null };
    case 'reset':
      return initialUpdate(action.firstUpload);
  }
}

export function waitingToUpdate(state: UpdateState): boolean {
  return state.phase === 'read' && state.answer === 'update' && state.updatedBy !== state.cvName;
}

export function isWaiting(state: UpdateState): boolean {
  return state.phase === 'uploading' || state.phase === 'reading';
}
