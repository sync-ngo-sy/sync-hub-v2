import { screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import { hasProfile, refusesPhoto, savesPhoto } from '@/features/profile/testing/handlers';
import { CANDIDATE, CANDIDATE_PROFILE } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const A_PHOTO_URL = 'http://sync.test/storage/v1/object/public/avatars/lina/photo.webp';

const PHOTO_TOO_LARGE = {
  type: 'urn:sync:problem:avatar-too-large',
  title: 'Content Too Large',
  status: 413,
  detail: 'A profile photo has to be 5 MB or smaller. Crop it or pick a smaller file.',
};

function aPhotoFile(name = 'me.jpg', type = 'image/jpeg', size = 4_000) {
  return new File([new Uint8Array(size)], name, { type });
}

function standInForTheImageDecodingAndCanvasJsdomLacks() {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) => {
    done(new Blob([new Uint8Array(128)], { type: 'image/webp' }));
  });
  for (const [property, value] of [
    ['naturalWidth', 1200],
    ['naturalHeight', 800],
    ['width', 600],
    ['height', 400],
  ] as const) {
    vi.spyOn(HTMLImageElement.prototype, property, 'get').mockReturnValue(value);
  }
}

async function openProfile() {
  server.use(...signedInAs(CANDIDATE), ...hasProfile(CANDIDATE_PROFILE));
  await renderApp('/profile');
  return userEvent.setup({ applyAccept: false });
}

async function pickAPhoto(user: UserEvent, file = aPhotoFile()) {
  await user.upload(screen.getByLabelText('Choose a profile photo'), file);
}

async function aFramedPhoto(user: UserEvent) {
  await pickAPhoto(user);
  await screen.findByRole('dialog', { name: 'Frame your photo' });
  await screen.findByAltText('The one you picked, ready to be framed');
}

function useThisPhoto(user: UserEvent) {
  return user.click(screen.getByRole('button', { name: 'Use this photo' }));
}

describe('putting a photo on the profile', () => {
  beforeEach(standInForTheImageDecodingAndCanvasJsdomLacks);

  it('frames the photo the candidate picked before anything is sent', async () => {
    const uploaded = vi.fn();
    server.use(...savesPhoto(A_PHOTO_URL, uploaded));
    const user = await openProfile();

    await pickAPhoto(user);

    expect(await screen.findByRole('dialog', { name: 'Frame your photo' })).toBeInTheDocument();
    expect(
      await screen.findByAltText('The one you picked, ready to be framed'),
    ).toBeInTheDocument();
    expect(uploaded).not.toHaveBeenCalled();
  });

  it('sends nothing when the candidate backs out of the crop', async () => {
    const uploaded = vi.fn();
    server.use(...savesPhoto(A_PHOTO_URL, uploaded));
    const user = await openProfile();
    await aFramedPhoto(user);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Frame your photo' })).toBeNull(),
    );
    expect(uploaded).not.toHaveBeenCalled();
  });

  it('uploads the framed square and the profile carries the photo straight away', async () => {
    const uploaded = vi.fn();
    server.use(...savesPhoto(A_PHOTO_URL, uploaded));
    const user = await openProfile();
    expect(screen.getByRole('button', { name: 'Add a photo' })).toBeInTheDocument();
    await aFramedPhoto(user);

    await useThisPhoto(user);

    await waitFor(() => expect(uploaded).toHaveBeenCalledTimes(1));
    expect(uploaded).toHaveBeenCalledWith(expect.stringMatching(/^multipart\/form-data/));
    expect(await screen.findByRole('button', { name: 'Change photo' })).toBeInTheDocument();
  });

  it('closes the crop once the photo is saved', async () => {
    server.use(...savesPhoto(A_PHOTO_URL));
    const user = await openProfile();
    await aFramedPhoto(user);

    await useThisPhoto(user);

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Frame your photo' })).toBeNull(),
    );
  });

  it('says so in place when the platform refuses the photo', async () => {
    server.use(...refusesPhoto(PHOTO_TOO_LARGE, 413));
    const user = await openProfile();
    await aFramedPhoto(user);

    await useThisPhoto(user);

    expect(await screen.findByText(PHOTO_TOO_LARGE.detail)).toBeInTheDocument();
  });

  it('refuses a file that is not a photo without opening the crop', async () => {
    const uploaded = vi.fn();
    server.use(...savesPhoto(A_PHOTO_URL, uploaded));
    const user = await openProfile();

    await pickAPhoto(user, aPhotoFile('cv.pdf', 'application/pdf'));

    expect(
      await screen.findByText('A profile photo has to be a JPEG, PNG or WebP image.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Frame your photo' })).toBeNull();
    expect(uploaded).not.toHaveBeenCalled();
  });
});
