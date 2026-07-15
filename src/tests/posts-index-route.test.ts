// B4 (2026-07-15 shared-components pass): the posts index's "Browse by Topic" grid promoted a
// topic with zero live posts (a "News, 0 posts" card) as a clickable dead end. `load` reads the
// real content corpus (no D1/mocking needed, the route is prerendered), so this test runs
// against whatever the corpus currently tags; it asserts the filtering behavior, not fixed counts.
// Review round (2026-07-15, svelte S1): `load` returned a `topics` payload (the full curated
// vocabulary) that no consumer ever read; the route now returns only `browseTopics`, so this test
// no longer references `data.topics`.
import { describe, expect, it } from 'vitest';
import { load } from '../routes/(site)/posts/+page.server';

type LoadResult = Exclude<Awaited<ReturnType<typeof load>>, void>;

async function runLoad(): Promise<LoadResult> {
  return (await load({} as never)) as LoadResult;
}

describe('/posts load: browseTopics filters out empty topics', () => {
  it('never includes a topic with zero live posts', async () => {
    const data = await runLoad();
    expect(data.browseTopics.length).toBeGreaterThan(0);
    for (const topic of data.browseTopics) {
      expect(topic.count).toBeGreaterThan(0);
    }
  });

  it('counts stats.topicCount as exactly the number of browsable topics', async () => {
    const data = await runLoad();
    expect(data.stats.topicCount).toBe(data.browseTopics.length);
  });

  it('never exposes the full curated vocabulary as data.topics', async () => {
    const data = await runLoad();
    expect('topics' in data).toBe(false);
  });
});
