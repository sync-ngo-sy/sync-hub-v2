import { describe, expect, it } from 'vitest';
import { cvUpload } from './use-upload-cv';

function serialized(file: File): FormData {
  const { bodySerializer } = cvUpload(file);
  return bodySerializer();
}

describe('the body a CV upload puts on the wire', () => {
  it('sends the chosen file under the name the API reads', () => {
    const file = new File([new Uint8Array(8)], 'lina-khoury-cv.pdf', { type: 'application/pdf' });

    expect(serialized(file).get('file')).toBe(file);
  });

  it('sends the file itself, not the name standing in for it in the typed body', () => {
    const file = new File([new Uint8Array(8)], 'lina-khoury-cv.pdf', { type: 'application/pdf' });

    const sent = serialized(file).get('file');
    expect(sent).toBeInstanceOf(File);
    expect((sent as File).name).toBe('lina-khoury-cv.pdf');
    expect((sent as File).type).toBe('application/pdf');
  });

  it('carries nothing but the file', () => {
    const file = new File([new Uint8Array(8)], 'cv.docx', { type: 'application/msword' });

    expect([...serialized(file).keys()]).toEqual(['file']);
  });
});
