import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { z } from 'zod';
import { NotFound } from '@/features/shell/components/not-found';
import { pageTitle } from '@/lib/page-title';

const CropPrototype = import.meta.env.DEV
  ? lazy(() =>
      import('@/features/crop-prototype/components/crop-prototype').then((module) => ({
        default: module.CropPrototype,
      })),
    )
  : null;

export const Route = createFileRoute('/crop-prototype')({
  validateSearch: z.object({ variant: z.string().optional() }),
  head: () => ({ meta: [{ title: pageTitle('Crop prototype') }] }),
  component: CropPrototypeRoute,
});

function CropPrototypeRoute() {
  const { variant } = Route.useSearch();
  const navigate = useNavigate();

  if (!CropPrototype) return <NotFound />;

  return (
    <Suspense fallback={null}>
      <CropPrototype
        variant={variant ?? 'A'}
        onVariant={(key) => {
          void navigate({ to: '/crop-prototype', search: { variant: key }, replace: true });
        }}
      />
    </Suspense>
  );
}
