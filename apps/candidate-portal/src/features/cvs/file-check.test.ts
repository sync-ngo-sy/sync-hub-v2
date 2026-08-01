import { describe, expect, it } from 'vitest';
import { MAX_CV_BYTES, rejectionFor } from './file-check';

function aFile(name: string, { type = '', bytes = 1024 } = {}): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('checking a CV before it is uploaded', () => {
  it('accepts a PDF', () => {
    expect(rejectionFor(aFile('lina-khoury.pdf', { type: 'application/pdf' }))).toBeNull();
  });

  it('accepts a DOCX', () => {
    const docx = aFile('lina-khoury.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    expect(rejectionFor(docx)).toBeNull();
  });

  it('accepts a DOC', () => {
    expect(rejectionFor(aFile('lina-khoury.doc', { type: 'application/msword' }))).toBeNull();
  });

  // The API guesses from the extension when the browser declares nothing, so this does too —
  // otherwise a file the API would take is refused here for no reason the reader can see.
  it('accepts a file the browser declared no type for, going by its extension', () => {
    expect(rejectionFor(aFile('lina-khoury.pdf'))).toBeNull();
  });

  it('names the three formats when the file is something else', () => {
    expect(rejectionFor(aFile('portfolio.png', { type: 'image/png' }))).toBe(
      'A CV has to be a PDF, DOC or DOCX file.',
    );
  });

  it('rejects an extension that lies about a type the platform does not take', () => {
    expect(rejectionFor(aFile('cv.pages', { type: 'application/x-iwork-pages-sffpages' }))).toBe(
      'A CV has to be a PDF, DOC or DOCX file.',
    );
  });

  it('says how large a CV may be when the file is over it', () => {
    const huge = aFile('lina-khoury.pdf', { type: 'application/pdf', bytes: MAX_CV_BYTES + 1 });
    expect(rejectionFor(huge)).toBe('That file is larger than 10 MB. Try a smaller one.');
  });

  it('takes a file of exactly the limit', () => {
    const exact = aFile('lina-khoury.pdf', { type: 'application/pdf', bytes: MAX_CV_BYTES });
    expect(rejectionFor(exact)).toBeNull();
  });

  it('rejects an empty file rather than letting the API do it', () => {
    expect(rejectionFor(aFile('lina-khoury.pdf', { type: 'application/pdf', bytes: 0 }))).toBe(
      'That file is empty.',
    );
  });

  it('reads the extension case-insensitively', () => {
    expect(rejectionFor(aFile('LINA-KHOURY.PDF'))).toBeNull();
  });
});
