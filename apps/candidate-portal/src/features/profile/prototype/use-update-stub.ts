// PROTOTYPE for #369 — throwaway. Drives `update-stub.ts` with fake timers and a canned parse, so
// every variant can be pushed through an upload without a stack behind it.

import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { filledFromCv } from '../fill';
import type { ProfileFormValues } from '../schemas/profile';
import { STUB_CV_NAME, STUB_DRAFT } from './stub-draft';
import {
  type Answer,
  initialUpdate,
  type Policy,
  reduceUpdate,
  type UpdateState,
  waitingToUpdate,
} from './update-stub';

const UPLOAD_MS = 900;
const PARSE_MS = 3200;

interface Form {
  getValues: UseFormReturn<ProfileFormValues>['getValues'];
  reset: UseFormReturn<ProfileFormValues>['reset'];
}

export interface UpdateStub {
  state: UpdateState;
  upload: () => void;
  fromNotification: () => void;
  reply: (answer: Answer) => void;
  dismiss: () => void;
  ask: () => void;
  forget: () => void;
  undo: () => void;
  saved: () => void;
  restart: (firstUpload: boolean) => void;
}

export function useUpdateStub(policy: Policy, { getValues, reset }: Form): UpdateStub {
  const [state, dispatch] = useReducer(
    (current: UpdateState, action: Parameters<typeof reduceUpdate>[1]) =>
      reduceUpdate(current, action, policy),
    false,
    initialUpdate,
  );
  const before = useRef<ProfileFormValues | null>(null);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    if (!waitingToUpdate(state)) return;
    before.current = getValues();
    reset(filledFromCv(before.current, STUB_DRAFT), { keepDefaultValues: true });
    dispatch({ type: 'updated' });
  }, [state, getValues, reset]);

  const upload = useCallback(() => {
    clearTimers();
    dispatch({ type: 'upload', cvName: STUB_CV_NAME });
    timers.current.push(
      window.setTimeout(() => dispatch({ type: 'reading' }), UPLOAD_MS),
      window.setTimeout(() => dispatch({ type: 'read' }), UPLOAD_MS + PARSE_MS),
    );
  }, [clearTimers]);

  const fromNotification = useCallback(() => {
    clearTimers();
    dispatch({ type: 'notification', cvName: STUB_CV_NAME });
  }, [clearTimers]);

  const undo = useCallback(() => {
    if (before.current) reset(before.current, { keepDefaultValues: true });
    dispatch({ type: 'undo' });
  }, [reset]);

  const restart = useCallback(
    (firstUpload: boolean) => {
      clearTimers();
      before.current = null;
      dispatch({ type: 'reset', firstUpload });
    },
    [clearTimers],
  );

  return {
    state,
    upload,
    fromNotification,
    reply: useCallback((answer: Answer) => dispatch({ type: 'reply', answer }), []),
    dismiss: useCallback(() => dispatch({ type: 'dismiss' }), []),
    ask: useCallback(() => dispatch({ type: 'ask' }), []),
    forget: useCallback(() => dispatch({ type: 'forget' }), []),
    undo,
    saved: useCallback(() => dispatch({ type: 'saved' }), []),
    restart,
  };
}
