import { describe, expect, it } from 'vitest';
import { deleteErrorMessage, uploadErrorMessage } from './messages';

describe('uploadErrorMessage', () => {
  it('names a duplicate when the conflict carries the existing cv_id', () => {
    expect(uploadErrorMessage({ status: 409, cv_id: 'cv_1' })).toMatch(
      /already uploaded this file/,
    );
  });

  it('explains the cap when the conflict carries no cv_id', () => {
    expect(uploadErrorMessage({ status: 409 })).toMatch(/maximum of 5 CVs/);
  });

  it('explains too-large and wrong-type refusals', () => {
    expect(uploadErrorMessage({ status: 413 })).toMatch(/larger than 10 MB/);
    expect(uploadErrorMessage({ status: 415 })).toMatch(/PDF, DOC or DOCX/);
  });
});

describe('deleteErrorMessage', () => {
  it('explains that the current CV must be replaced before deletion', () => {
    expect(deleteErrorMessage({ status: 409 })).toMatch(/Make another CV current first/);
  });
});
