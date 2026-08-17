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

function standInForTheImageDecodingAndCanvasJsdomLacks({
  laidOut = true,
}: {
  laidOut?: boolean;
} = {}) {
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) => {
    done(new Blob([new Uint8Array(128)], { type: 'image/webp' }));
  });
  for (const [property, value] of [
    ['naturalWidth', 1200],
    ['naturalHeight', 800],
    ['width', laidOut ? 600 : 0],
    ['height', laidOut ? 400 : 0],
  ] as const) {
    vi.spyOn(HTMLImageElement.prototype, property, 'get').mockReturnValue(value);
  }
  return drawImage;
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

function theProfilePhoto(): HTMLElement {
  const card = screen.getByRole('article', { name: CANDIDATE_PROFILE.full_name });
  const photo = card.querySelector<HTMLElement>('[data-slot="avatar"]');
  if (!photo) throw new Error('no photo on the profile card');
  return photo;
}

describe('putting a photo on the profile', () => {
  beforeEach(() => {
    standInForTheImageDecodingAndCanvasJsdomLacks();
  });

  it('starts the same replacement from the photo itself', async () => {
    server.use(...savesPhoto(A_PHOTO_URL));
    const user = await openProfile();
    const file = screen.getByLabelText('Choose a profile photo');
    const asked = vi.spyOn(file, 'click');

    await user.click(theProfilePhoto());

    expect(asked).toHaveBeenCalledTimes(1);
  });

  it('leaves the photo out of the keyboard path the button already holds', async () => {
    server.use(...savesPhoto(A_PHOTO_URL));
    await openProfile();

    const opener = theProfilePhoto().closest('button');
    expect(opener).toHaveAttribute('tabindex', '-1');
    expect(opener).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getAllByRole('button', { name: /photo/i })).toHaveLength(1);
  });

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

describe('what the frame holds is what is uploaded', () => {
  const CENTRE_SQUARE = { x: 280, y: 80, side: 640 };

  it('cuts out the square the circle held', async () => {
    const drawImage = standInForTheImageDecodingAndCanvasJsdomLacks();
    server.use(...savesPhoto(A_PHOTO_URL));
    const user = await openProfile();
    await aFramedPhoto(user);

    await useThisPhoto(user);

    await waitFor(() => expect(drawImage).toHaveBeenCalled());
    expect(drawImage).toHaveBeenCalledWith(
      expect.anything(),
      CENTRE_SQUARE.x,
      CENTRE_SQUARE.y,
      CENTRE_SQUARE.side,
      CENTRE_SQUARE.side,
      0,
      0,
      CENTRE_SQUARE.side,
      CENTRE_SQUARE.side,
    );
  });

  it('frames the same square when the browser has not laid the photo out yet', async () => {
    const drawImage = standInForTheImageDecodingAndCanvasJsdomLacks({ laidOut: false });
    server.use(...savesPhoto(A_PHOTO_URL));
    const user = await openProfile();
    await aFramedPhoto(user);

    await useThisPhoto(user);

    await waitFor(() => expect(drawImage).toHaveBeenCalled());
    expect(drawImage).toHaveBeenCalledWith(
      expect.anything(),
      CENTRE_SQUARE.x,
      CENTRE_SQUARE.y,
      CENTRE_SQUARE.side,
      CENTRE_SQUARE.side,
      0,
      0,
      CENTRE_SQUARE.side,
      CENTRE_SQUARE.side,
    );
  });
});
