import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';

type CanonicalRole = components['schemas']['CanonicalRole'];
type CanonicalSkill = components['schemas']['CanonicalSkill'];
type Language = components['schemas']['Language'];
type Location = components['schemas']['Location'];
type ProblemDetail = components['schemas']['ProblemDetail'];

export function hasCanonicalSkills(skills: CanonicalSkill[]) {
  return [http.get('/v1/skills', ({ response }) => response(200).json(skills))];
}

export function hasLanguages(languages: Language[]) {
  return [http.get('/v1/languages', ({ response }) => response(200).json(languages))];
}

export function hasLocations(locations: Location[]) {
  return [http.get('/v1/locations', ({ response }) => response(200).json(locations))];
}

export function hasCanonicalRoles(roles: CanonicalRole[]) {
  return [http.get('/v1/roles', ({ response }) => response(200).json(roles))];
}

export function failsToLoadCanonicalSkills(problem: ProblemDetail) {
  return [http.get('/v1/skills', ({ response }) => response(500).json(problem))];
}
