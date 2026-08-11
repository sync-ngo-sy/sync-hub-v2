import { describe, expect, it } from 'vitest';
import type { TrackedLink, TrackedLinkReport } from './tracked-link';
import {
  DIRECT,
  trackedLinkAddress,
  trackedLinkState,
  viewsPerSource,
  viewsSummary,
} from './tracked-link';

function linksRanked(links: TrackedLink[]) {
  return viewsPerSource(report(links)).filter((row) => row.id !== DIRECT);
}

function report(
  items: TrackedLink[],
  directViewCount = 0,
  viewCount = items.reduce((total, one) => total + one.view_count, 0) + directViewCount,
): TrackedLinkReport {
  return { items, direct_view_count: directViewCount, view_count: viewCount };
}

function link(overrides: Partial<TrackedLink> & { id: string }): TrackedLink {
  return {
    name: `Link ${overrides.id}`,
    token: `token-${overrides.id}`,
    is_active: true,
    expires_at: null,
    created_at: '2026-07-20T09:00:00Z',
    view_count: 0,
    ...overrides,
  };
}

const NOW = new Date('2026-08-03T12:00:00Z');

describe('a tracked link address', () => {
  it('is the Candidate Portal landing for the link token', () => {
    expect(trackedLinkAddress('QkJ9lC3n')).toBe('http://localhost:5173/l/QkJ9lC3n');
  });
});

describe('what a tracked link is doing', () => {
  it('is live while it is on and has not passed its closing date', () => {
    expect(trackedLinkState(link({ id: '1' }), NOW)).toEqual({
      kind: 'live',
      label: 'Live',
      tone: 'active',
    });
    expect(
      trackedLinkState(link({ id: '1', expires_at: '2026-09-01T09:00:00Z' }), NOW),
    ).toHaveProperty('label', 'Live');
  });

  it('is off once it is turned off, whatever its closing date says', () => {
    expect(trackedLinkState(link({ id: '1', is_active: false }), NOW)).toEqual({
      kind: 'off',
      label: 'Off',
      tone: 'ended',
    });
    expect(
      trackedLinkState(
        link({ id: '1', is_active: false, expires_at: '2026-07-01T09:00:00Z' }),
        NOW,
      ),
    ).toHaveProperty('label', 'Off');
  });

  it('is expired once its closing date has passed', () => {
    expect(trackedLinkState(link({ id: '1', expires_at: '2026-08-01T09:00:00Z' }), NOW)).toEqual({
      kind: 'expired',
      label: 'Expired',
      tone: 'ended',
    });
  });
});

describe('the views each link brought', () => {
  it('ranks the links by what they brought, deepest teal first', () => {
    const bars = linksRanked([
      link({ id: '1', name: 'Facebook page', view_count: 97 }),
      link({ id: '2', name: 'LinkedIn post', view_count: 342 }),
      link({ id: '3', name: 'WhatsApp groups', view_count: 281 }),
    ]);

    expect(bars.map((bar) => bar.name)).toEqual([
      'LinkedIn post',
      'WhatsApp groups',
      'Facebook page',
    ]);
    expect(bars.map((bar) => bar.fill)).toEqual([
      'var(--chart-1)',
      'var(--chart-2)',
      'var(--chart-3)',
    ]);
  });

  it('keeps everything past the fourth link on the ramp, never on the neutral step', () => {
    const bars = linksRanked(
      [10, 9, 8, 7, 6, 5].map((views, index) =>
        link({ id: String(index), name: `Link ${index}`, view_count: views }),
      ),
    );

    expect(bars.slice(4).map((bar) => bar.fill)).toEqual(['var(--chart-4)', 'var(--chart-4)']);
    expect(bars.map((bar) => bar.fill)).not.toContain('var(--chart-5)');
  });

  it('keeps a link that brought nothing, and orders ties by name', () => {
    const bars = linksRanked([
      link({ id: '1', name: 'Notice board', view_count: 0 }),
      link({ id: '2', name: 'Alumni list', view_count: 0 }),
    ]);

    expect(bars.map((bar) => [bar.name, bar.views])).toEqual([
      ['Alumni list', 0],
      ['Notice board', 0],
    ]);
  });

  it('reads the chart out for anyone who cannot see it', () => {
    const summary = viewsSummary(
      linksRanked([
        link({ id: '1', name: 'LinkedIn post', view_count: 342 }),
        link({ id: '2', name: 'Notice board', view_count: 1 }),
      ]),
    );

    expect(summary).toBe(
      'Views per source. LinkedIn post: 342 views, 100%. Notice board: 1 view, 0%.',
    );
  });

  it('stops reading out after the eighth link rather than listing every source', () => {
    const summary = viewsSummary(
      linksRanked(
        Array.from({ length: 11 }, (_, index) =>
          link({ id: String(index), name: `Link ${index}`, view_count: 100 - index }),
        ),
      ),
    );

    expect(summary).toContain('Link 7: 93 views, 9%.');
    expect(summary).not.toContain('Link 8');
    expect(summary).toContain('And 3 more sources, further down.');
  });
});

describe('the views no link brought', () => {
  const LINKS = [
    link({ id: '1', name: 'LinkedIn post', view_count: 60 }),
    link({ id: '2', name: 'Notice board', view_count: 20 }),
  ];

  it('is charted as a source of its own, ranked among the links', () => {
    const bars = viewsPerSource(report(LINKS, 20));

    expect(bars.map((bar) => [bar.name, bar.views, bar.share])).toEqual([
      ['LinkedIn post', 60, 60],
      ['Direct', 20, 20],
      ['Notice board', 20, 20],
    ]);
  });

  it('is still reported when no such traffic arrived', () => {
    expect(viewsPerSource(report(LINKS)).find((bar) => bar.name === 'Direct')).toMatchObject({
      views: 0,
      share: 0,
    });
  });
});

describe('a share of the views', () => {
  it('allocates whole percentages that sum to one hundred', () => {
    const bars = viewsPerSource(
      report([link({ id: '1', view_count: 1 }), link({ id: '2', view_count: 1 })], 1),
    );

    expect(bars.reduce((sum, bar) => sum + (bar.share ?? 0), 0)).toBe(100);
    expect(bars.map((bar) => bar.share).sort()).toEqual([33, 33, 34]);
  });

  it('has no percentage before the Job has views', () => {
    expect(viewsPerSource(report([link({ id: '1' })])).map((bar) => bar.share)).toEqual([
      null,
      null,
    ]);
  });
});
