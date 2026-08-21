export const PLATFORM_COUNTS = [
  ['tenants', 'Tenants'],
  ['candidates', 'Candidates'],
  ['jobs', 'Jobs'],
  ['applications', 'Applications'],
] as const;

export const PLATFORM_COUNT_LABELS = PLATFORM_COUNTS.map(([, label]) => label);

export const OVERVIEW_TITLE = 'Platform overview';
