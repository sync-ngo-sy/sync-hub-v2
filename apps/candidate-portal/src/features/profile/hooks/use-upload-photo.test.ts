import { describe, expect, it } from 'vitest';
import { UPLOAD_MEDIA_TYPE } from '../crop';
import { photoUpload, UPLOAD_FILENAME } from './use-upload-photo';

function serialized(photo: Blob): FormData {
  const { bodySerializer } = photoUpload(photo);
  return bodySerializer();
}

describe('the body a photo upload puts on the wire', () => {
  it('sends the framed square under the name the API reads', () => {
    const sent = serialized(new Blob([new Uint8Array(8)], { type: UPLOAD_MEDIA_TYPE })).get('file');

    expect(sent).toBeInstanceOf(File);
    expect((sent as File).name).toBe(UPLOAD_FILENAME);
    expect((sent as File).type).toBe(UPLOAD_MEDIA_TYPE);
  });

  it('carries nothing but the photo', () => {
    const body = serialized(new Blob([new Uint8Array(8)], { type: UPLOAD_MEDIA_TYPE }));

    expect([...body.keys()]).toEqual(['file']);
  });
});
