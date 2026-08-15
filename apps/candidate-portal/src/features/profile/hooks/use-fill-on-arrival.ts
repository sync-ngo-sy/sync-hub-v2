import { useSearch } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { type Cv, isReady } from '@/features/cvs/cv';
import { useMyCvs } from '@/features/cvs/hooks/use-my-cvs';

export function useFillOnArrival(from: (cv: Cv) => Promise<void>): void {
  const { fill } = useSearch({ from: '/_account/profile' });
  const cvs = useMyCvs();
  const answered = useRef<string | null>(null);

  useEffect(() => {
    if (!fill || answered.current === fill) return;
    const cv = cvs.data?.find((entry) => entry.id === fill);
    if (!cv) return;
    answered.current = fill;
    if (isReady(cv)) void from(cv);
  }, [cvs.data, fill, from]);
}
