import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES } from '../constants';
import { validateCvFile } from './upload-schema';

function file(name: string, type: string, size = 1024): File {
  const blob = new File([new Uint8Array(size)], name, { type });
  return blob;
}

describe('validateCvFile', () => {
  it('accepts a PDF, a DOC, and a DOCX', () => {
    expect(validateCvFile(file('cv.pdf', 'application/pdf'))).toBeNull();
    expect(validateCvFile(file('cv.doc', 'application/msword'))).toBeNull();
    expect(
      validateCvFile(
        file('cv.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      ),
    ).toBeNull();
  });

  it('accepts a supported extension even when the browser leaves the MIME type blank', () => {
    expect(validateCvFile(file('resume.docx', ''))).toBeNull();
  });

  it('rejects an unsupported type by extension and MIME', () => {
    expect(validateCvFile(file('photo.png', 'image/png'))).toMatch(/PDF, DOC or DOCX/);
  });

  it('rejects a file larger than the platform accepts', () => {
    expect(validateCvFile(file('big.pdf', 'application/pdf', MAX_FILE_BYTES + 1))).toMatch(
      /larger than 10 MB/,
    );
  });
});
