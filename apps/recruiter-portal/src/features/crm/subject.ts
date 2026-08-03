/**
 * What the notes and the Tags are about, in the words the cards say it in. The interactions are
 * the same on an Application and on a Candidate; only the noun on screen differs, and a Tag's
 * scope is named for the plural because that is how the vocabulary is divided.
 */
export interface CrmSubject {
  one: string;
  many: string;
}

export const APPLICATION: CrmSubject = { one: 'Application', many: 'Applications' };

export const CANDIDATE: CrmSubject = { one: 'Candidate', many: 'Candidates' };
