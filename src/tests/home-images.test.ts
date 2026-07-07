import { describe, it, expect } from 'vitest';
import type { MediaEntry, MediaManifest } from '@glw907/cairn-cms/media';
import { homeImages } from '$theme/home-images';

const HERO_HASH = 'eb71d593c9eaf136';
const FLEET_HASH = 'aced8df0a45f9553';

function entry(hash: string, alt: string): MediaEntry {
  return {
    hash,
    sha256: hash.repeat(4),
    slug: 'a-photo',
    displayName: 'a-photo',
    originalFilename: 'a-photo.jpg',
    alt,
    ext: 'jpg',
    contentType: 'image/jpeg',
    bytes: 100,
    width: null,
    height: null,
    createdAt: '2026-07-06T00:00:00.000Z',
  };
}

describe('homeImages', () => {
  it('resolves a placement whose token is in the manifest', () => {
    const manifest: MediaManifest = { [HERO_HASH]: entry(HERO_HASH, 'A real hero photo.') };
    const images = homeImages(manifest, (ref) => `/media/${ref.hash}.jpg`);
    expect(images.hero).toEqual({ url: `/media/${HERO_HASH}.jpg`, alt: 'A real hero photo.' });
  });

  it('degrades a placement with no matching manifest entry to undefined, not a throw', () => {
    const manifest: MediaManifest = { [FLEET_HASH]: entry(FLEET_HASH, 'A real fleet photo.') };
    const images = homeImages(manifest, (ref) => `/media/${ref.hash}.jpg`);
    expect(images.hero).toBeUndefined();
    expect(images.facilities).toBeUndefined();
    expect(images.fleet).toEqual({ url: `/media/${FLEET_HASH}.jpg`, alt: 'A real fleet photo.' });
  });

  it('degrades a placement to undefined when the resolver itself returns no URL', () => {
    const manifest: MediaManifest = { [HERO_HASH]: entry(HERO_HASH, 'A real hero photo.') };
    const images = homeImages(manifest, () => undefined);
    expect(images.hero).toBeUndefined();
  });
});
