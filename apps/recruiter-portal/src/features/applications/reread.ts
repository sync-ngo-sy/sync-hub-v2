import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  ApplicationSort,
  PipelineStatus,
  ReceivedWithin,
  ScreeningVerdict,
} from './application';

export const TENANT_APPLICATIONS_PATH = '/v1/tenants/me/applications';
export const TRIAGE_PATH = '/v1/tenants/me/jobs/{job_id}/applications';
export const APPLICATION_PATH = '/v1/tenants/me/applications/{application_id}';
export const ASSESSMENT_PATH = '/v1/tenants/me/applications/{application_id}/assessment';
export const MESSAGES_PATH = '/v1/tenants/me/applications/{application_id}/messages';
export const NOTES_PATH = '/v1/tenants/me/applications/{application_id}/notes';
export const NOTE_PATH = '/v1/tenants/me/applications/{application_id}/notes/{note_id}';
export const TAGS_PATH = '/v1/tenants/me/applications/{application_id}/tags';
export const TAG_PATH = '/v1/tenants/me/applications/{application_id}/tags/{tag_id}';

export const TENANT_APPLICATIONS_PAGE_SIZE = 20;

function forApplication(applicationId: string) {
  return { params: { path: { application_id: applicationId } } };
}

/** What a list asks the API for, once its Reading has been resolved: no status at all is every
 * status, and every verdict is named. */
export interface ApplicationsAsked {
  statuses: PipelineStatus[] | undefined;
  verdicts: ScreeningVerdict[];
  sort: ApplicationSort;
}

export interface TenantApplicationsAsked extends ApplicationsAsked {
  received: ReceivedWithin | undefined;
}

export function tenantApplications(asked: TenantApplicationsAsked) {
  return {
    params: {
      query: {
        limit: TENANT_APPLICATIONS_PAGE_SIZE,
        status: asked.statuses,
        qualification_status: asked.verdicts,
        received_within: asked.received ?? null,
        sort: asked.sort,
      },
    },
  };
}

export function applicationReview(applicationId: string) {
  return api.queryOptions('get', APPLICATION_PATH, forApplication(applicationId));
}

export function applicationTags(applicationId: string) {
  return api.queryOptions('get', TAGS_PATH, forApplication(applicationId));
}

export function matchAssessment(applicationId: string) {
  return api.queryOptions('get', ASSESSMENT_PATH, forApplication(applicationId));
}

function everyTenantApplicationsReading() {
  return ['get', TENANT_APPLICATIONS_PATH] as const;
}

function everyTriageReading() {
  return ['get', TRIAGE_PATH] as const;
}

function everyNotesReading(applicationId: string) {
  return ['get', NOTES_PATH, forApplication(applicationId)] as const;
}

export function useRereadMovedApplication(applicationId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: applicationReview(applicationId).queryKey }),
      queryClient.invalidateQueries({ queryKey: everyTriageReading() }),
      queryClient.invalidateQueries({ queryKey: everyTenantApplicationsReading() }),
    ]);
}

export function useRereadMatchAssessment(applicationId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: matchAssessment(applicationId).queryKey });
}

export function useRereadApplicationNotes(applicationId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: everyNotesReading(applicationId) });
}

export function useRereadApplicationTags(applicationId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: applicationTags(applicationId).queryKey });
}
