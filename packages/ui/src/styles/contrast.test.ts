import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const STYLESHEET = readFileSync(join(import.meta.dirname, 'globals.css'), 'utf8');

const AA_TEXT = 4.5;
const READS_AS_ANOTHER_SURFACE = 1.2;

type Rgb = [red: number, green: number, blue: number];
type Colour = { rgb: Rgb; alpha: number };

function block(selector: string): Map<string, string> {
  const body = STYLESHEET.split(selector)[1]?.split('}')[0] ?? '';
  return new Map(
    [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((declaration) => [
      declaration[1] ?? '',
      (declaration[2] ?? '').trim(),
    ]),
  );
}

const THEMES = {
  light: block('\n:root {'),
  dark: block('\n.dark {'),
};

function parse(value: string): Colour {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex?.[1]) {
    const digits = hex[1];
    return {
      rgb: [0, 2, 4].map((at) => Number.parseInt(digits.slice(at, at + 2), 16)) as Rgb,
      alpha: 1,
    };
  }

  const rgba = /^rgba?\(([^)]+)\)$/.exec(value);
  if (rgba?.[1]) {
    const parts = rgba[1].split(',').map((part) => Number.parseFloat(part));
    return { rgb: parts.slice(0, 3) as Rgb, alpha: parts[3] ?? 1 };
  }

  throw new Error(`No colour to read in "${value}".`);
}

function token(theme: keyof typeof THEMES, name: string): Colour {
  const value = THEMES[theme].get(name);
  if (!value) throw new Error(`The ${theme} theme declares no ${name}.`);
  return parse(value);
}

/** What the eye ends up with when a translucent colour — a `/10` tint, an `rgba()` token — is
 * painted over the surface below it. Contrast is a question about that result, never about the
 * colour the stylesheet names. */
function over(top: Colour, bottom: Colour, opacity = 1): Colour {
  const alpha = top.alpha * opacity;
  return {
    rgb: top.rgb.map((channel, index) =>
      Math.round(channel * alpha + (bottom.rgb[index] ?? 0) * (1 - alpha)),
    ) as Rgb,
    alpha: 1,
  };
}

function luminance({ rgb }: Colour): number {
  const [red, green, blue] = rgb.map((channel) => {
    const ratio = channel / 255;
    return ratio <= 0.04045 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(one: Colour, other: Colour): number {
  const [lighter, darker] = [luminance(one), luminance(other)].sort((a, b) => b - a) as [
    number,
    number,
  ];
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

const THEME_NAMES = Object.keys(THEMES) as (keyof typeof THEMES)[];

describe('the destructive colour', () => {
  it.each(THEME_NAMES)('reads on the plain surfaces of the %s theme', (theme) => {
    const destructive = token(theme, 'destructive');

    for (const surface of ['background', 'card', 'popover'] as const) {
      expect(contrast(destructive, token(theme, surface))).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  /** The destructive Button and Badge paint the destructive colour on a tint of itself, which
   * lifts the surface towards the text and takes the pair closer to failing than the plain
   * surfaces do. The tint is heavier in the dark theme, so each theme is measured with its own. */
  it.each(THEME_NAMES)('reads on its own tint in the %s theme', (theme) => {
    const destructive = token(theme, 'destructive');
    const tint = theme === 'light' ? 0.1 : 0.2;

    for (const surface of ['background', 'card', 'popover'] as const) {
      const tinted = over(destructive, token(theme, surface), tint);
      expect(contrast(destructive, tinted)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it.each(THEME_NAMES)('carries its own foreground in the %s theme', (theme) => {
    expect(
      contrast(token(theme, 'destructive'), token(theme, 'destructive-foreground')),
    ).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe('an active item', () => {
  it.each(THEME_NAMES)('sits on a surface of its own in the %s sidebar', (theme) => {
    const sidebar = token(theme, 'sidebar');
    const active = over(token(theme, 'sidebar-accent'), sidebar);

    expect(contrast(active, sidebar)).toBeGreaterThanOrEqual(READS_AS_ANOTHER_SURFACE);
    expect(contrast(token(theme, 'sidebar-accent-foreground'), active)).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
  });

  it.each(THEME_NAMES)('sits on a surface of its own in the %s theme', (theme) => {
    const background = token(theme, 'background');
    const active = over(token(theme, 'accent'), background);

    expect(contrast(active, background)).toBeGreaterThanOrEqual(READS_AS_ANOTHER_SURFACE);
    expect(contrast(token(theme, 'accent-foreground'), active)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});
