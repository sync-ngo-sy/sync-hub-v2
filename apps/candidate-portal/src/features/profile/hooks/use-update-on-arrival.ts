import { useSearch } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { type Cv, isReady } from '@/features/cvs/cv';
import { useMyCvs } from '@/features/cvs/hooks/use-my-cvs';

export function useUpdateOnArrival(from: (cv: Cv) => Promise<void>): void {
  const { update } = useSearch({ from: '/_account/profile' });
  const cvs = useMyCvs();
  const answered = useRef<string | null>(null);

  useEffect(() => {
    if (!update || answered.current === update) return;
    const cv = cvs.data?.find((entry) => entry.id === update);
    if (!cv) return;
    answered.current = update;
    if (isReady(cv)) void from(cv);
  }, [cvs.data, update, from]);
}
