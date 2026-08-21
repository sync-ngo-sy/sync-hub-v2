import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@sync/ui/components/ui/breadcrumb';
import { Link } from '@tanstack/react-router';
import { Fragment } from 'react';
import { applicationsAddress, jobApplicationsAddress } from '@/features/applications/reading';
import { candidatesAddress } from '@/features/candidates/reading';
import type { Crumb, CrumbTarget } from '@/features/shell/origin';

function targetLink(target: CrumbTarget) {
  switch (target.at) {
    case 'dashboard':
      return <Link to="/dashboard" />;
    case 'jobs':
      return <Link to="/jobs" search={{}} />;
    case 'applications':
      return <Link to="/applications" search={applicationsAddress(target.reading)} />;
    case 'placements':
      return <Link to="/placements" search={{}} />;
    case 'candidates':
      return <Link to="/candidates" search={candidatesAddress(target.reading)} />;
    case 'talent-pool':
      return <Link to="/talent-pool" search={{}} />;
    case 'job':
      return (
        <Link
          to="/jobs/$jobId"
          params={{ jobId: target.jobId }}
          search={{ ...jobApplicationsAddress(target.reading), tab: 'applications' as const }}
        />
      );
    case 'application':
      return (
        <Link
          to="/applications/$applicationId"
          params={{ applicationId: target.applicationId }}
          search={{}}
        />
      );
  }
}

export function PageBreadcrumbs({ trail }: { trail: Crumb[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {trail.map((crumb, index) => (
          <Fragment key={crumb.label}>
            {index > 0 ? <BreadcrumbSeparator /> : null}
            <BreadcrumbItem>
              {crumb.target ? (
                <BreadcrumbLink render={targetLink(crumb.target)}>{crumb.label}</BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
