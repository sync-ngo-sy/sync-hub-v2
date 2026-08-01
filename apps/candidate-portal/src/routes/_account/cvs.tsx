import { createFileRoute } from '@tanstack/react-router';
import { CvsPage } from '@/features/cvs/components/cvs-page';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_account/cvs')({
  head: () => ({ meta: [{ title: pageTitle('CVs') }] }),
  component: CvsPage,
});
