export interface CrmSubject {
  one: string;
  many: string;
}

export const APPLICATION: CrmSubject = { one: 'Application', many: 'Applications' };

export const CANDIDATE: CrmSubject = { one: 'Candidate', many: 'Candidates' };
