/** What the notes and the Tags are about: the interactions are the same on an Application and on
 * a Candidate, and only the noun on screen differs. */
export interface CrmSubject {
  one: string;
  many: string;
}

export const APPLICATION: CrmSubject = { one: 'Application', many: 'Applications' };

export const CANDIDATE: CrmSubject = { one: 'Candidate', many: 'Candidates' };
