const feeds = [
  {
    category: 'College Admissions',
    query: 'site:newsroom.collegeboard.org (college OR SAT OR scholarship)'
  },
  {
    category: 'Financial Aid',
    query: '(site:studentaid.gov OR site:financialaidtoolkit.ed.gov) (FAFSA OR financial aid OR scholarship)'
  },
  {
    category: 'Education & Careers',
    query: '(site:ed.gov OR site:bls.gov) (student OR education OR career)'
  }
];

const decodeXml = (value = '') => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

const readTag = (item, tag) => {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return decodeXml(match?.[1]?.trim() || '');
};

const parseFeed = (xml, category) => {
  const entries = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

  return entries.slice(0, 6).map((entry) => {
    const rawTitle = readTag(entry, 'title');
    const source = readTag(entry, 'source') || 'Trusted education source';
    const suffix = ` - ${source}`;
    const title = rawTitle.endsWith(suffix) ? rawTitle.slice(0, -suffix.length) : rawTitle;
    const published = readTag(entry, 'pubDate');
    const url = readTag(entry, 'link');

    return {
      category,
      title,
      source,
      url,
      published: published ? new Date(published).toISOString() : null
    };
  }).filter((item) => item.title && item.url.startsWith('https://'));
};

export async function onRequestGet() {
  try {
    const responses = await Promise.all(feeds.map(async ({ category, query }) => {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Next Generation Advocates educational resource feed' }
      });

      if (!response.ok) throw new Error(`Feed returned ${response.status}`);
      return parseFeed(await response.text(), category);
    }));

    const items = responses
      .flatMap((items) => items.slice(0, 4))
      .filter((item, index, all) => all.findIndex((candidate) => candidate.title === item.title) === index)
      .sort((a, b) => Date.parse(b.published || '') - Date.parse(a.published || ''))
      .slice(0, 12);

    return Response.json(
      { items, updatedAt: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 'public, max-age=900, s-maxage=1800',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  } catch {
    return Response.json(
      { items: [], error: 'Live updates are temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
