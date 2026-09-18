const feeds = [
  {
    category: 'College Admissions',
    query: 'site:newsroom.collegeboard.org (college OR SAT OR scholarship)',
    officialUrl: 'https://newsroom.collegeboard.org/',
    officialParser: parseCollegeBoard
  },
  {
    category: 'Financial Aid',
    query: '(site:studentaid.gov OR site:financialaidtoolkit.ed.gov) (FAFSA OR financial aid OR scholarship)',
    officialUrl: 'https://fsapartners.ed.gov/knowledge-center/library/resource-type/Electronic%20Announcements?limit=25&moderation_state=published&page=0',
    officialParser: parseFederalStudentAid
  },
  {
    category: 'Education & Careers',
    query: '(site:ed.gov OR site:bls.gov) (student OR education OR career)',
    officialUrl: 'https://www.ed.gov/about/news/press-release',
    officialParser: parseEducationDepartment
  }
];

const decodeXml = (value = '') => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

const decodeHtml = (value = '') => decodeXml(value)
  .replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));

const cleanText = (value = '') => decodeHtml(value)
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const readTag = (item, tag) => {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return decodeXml(match?.[1]?.trim() || '');
};

const toIsoDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const absoluteUrl = (value, base) => {
  try {
    return new URL(decodeHtml(value), base).href;
  } catch {
    return '';
  }
};

const parseFeed = (xml, category) => {
  const entries = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

  return entries.slice(0, 8).map((entry) => {
    const rawTitle = cleanText(readTag(entry, 'title'));
    const source = cleanText(readTag(entry, 'source')) || 'Trusted education source';
    const suffix = ` - ${source}`;
    const title = rawTitle.endsWith(suffix) ? rawTitle.slice(0, -suffix.length) : rawTitle;
    const published = toIsoDate(readTag(entry, 'pubDate'));
    const url = readTag(entry, 'link');

    return { category, title, source, url, published };
  }).filter((item) => item.title && item.url.startsWith('https://'));
};

function parseCollegeBoard(html) {
  const items = [];
  const pattern = /<a href="([^"]+)">\s*<div class="container-fluid">[\s\S]*?<p[^>]*>\s*(\d{2}\/\d{2}\/\d{4})\s*<\/p>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  let match;

  while ((match = pattern.exec(html)) && items.length < 6) {
    items.push({
      category: 'College Admissions',
      title: cleanText(match[3]),
      source: 'College Board',
      url: absoluteUrl(match[1], 'https://newsroom.collegeboard.org/'),
      published: toIsoDate(`${match[2]} 12:00:00 UTC`)
    });
  }

  return items.filter((item) => item.title && item.url && item.published);
}

function parseFederalStudentAid(html) {
  const items = [];
  const pattern = /<div class="w-100 mb-3 category">[\s\S]*?<div class="category-link category-title"><a href="([^"]+)">([\s\S]*?)<\/a><\/div>\s*<div[^>]*category-posted-date[^>]*>\s*(\d{4}-\d{2}-\d{2})\s*<\/div>/gi;
  const relevant = /FAFSA|Pell|student aid|financial aid|scholarship|grant|loan/i;
  let match;

  while ((match = pattern.exec(html)) && items.length < 6) {
    const title = cleanText(match[2]);
    if (!relevant.test(title)) continue;
    items.push({
      category: 'Financial Aid',
      title,
      source: 'Federal Student Aid',
      url: absoluteUrl(match[1], 'https://fsapartners.ed.gov/'),
      published: toIsoDate(`${match[3]}T12:00:00Z`)
    });
  }

  return items.filter((item) => item.title && item.url && item.published);
}

function parseEducationDepartment(html) {
  const items = [];
  const rows = html.match(/<div class="views-row">[\s\S]*?(?=<div class="views-row">|<\/main>|$)/gi) || [];

  for (const row of rows) {
    if (items.length >= 6) break;
    const link = row.match(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const date = row.match(/<time datetime="([^"]+)"/i);
    if (!link || !date) continue;
    items.push({
      category: 'Education & Careers',
      title: cleanText(link[2]),
      source: 'U.S. Department of Education',
      url: absoluteUrl(link[1], 'https://www.ed.gov/'),
      published: toIsoDate(date[1])
    });
  }

  return items.filter((item) => item.title && item.url && item.published);
}

const fetchText = async (url, accept) => {
  const response = await fetch(url, { headers: { Accept: accept } });
  if (!response.ok) throw new Error(`Source returned ${response.status}`);
  return response.text();
};

const loadFeed = async ({ category, query, officialUrl, officialParser }) => {
  const googleUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const requireItems = (items) => {
    if (!items.length) throw new Error('Source returned no usable articles');
    return items;
  };

  try {
    return await Promise.any([
      fetchText(officialUrl, 'text/html, application/xhtml+xml;q=0.9').then(officialParser).then(requireItems),
      fetchText(googleUrl, 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8').then((xml) => parseFeed(xml, category)).then(requireItems)
    ]);
  } catch {
    return [];
  }
};

export async function onRequestGet() {
  const responses = await Promise.all(feeds.map(loadFeed));
  const items = responses
    .flat()
    .filter((item, index, all) => all.findIndex((candidate) => candidate.title.toLowerCase() === item.title.toLowerCase()) === index)
    .sort((a, b) => Date.parse(b.published || '') - Date.parse(a.published || ''))
    .slice(0, 12);

  if (!items.length) {
    return Response.json(
      { items: [], error: 'Live updates are temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'X-NGA-Feed-Version': 'resilient-v2' } }
    );
  }

  return Response.json(
    { items, updatedAt: new Date().toISOString() },
    {
      headers: {
        'Cache-Control': 'public, max-age=900, s-maxage=1800',
        'Access-Control-Allow-Origin': '*',
        'X-NGA-Feed-Version': 'resilient-v2'
      }
    }
  );
}
