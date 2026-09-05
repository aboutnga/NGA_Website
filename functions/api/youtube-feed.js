const feedUrl = 'https://www.youtube.com/feeds/videos.xml?channel_id=UCACxxbBGH6Q0fDlFIuoz6aA';

const decodeXml = (value = '') => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

const readTag = (entry, tag) => {
  const match = entry.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return decodeXml(match?.[1]?.trim() || '');
};

export async function onRequestGet() {
  try {
    const response = await fetch(feedUrl, {
      headers: { 'User-Agent': 'Next Generation Advocates YouTube feed' }
    });
    if (!response.ok) throw new Error(`Feed returned ${response.status}`);

    const xml = await response.text();
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/gi) || [];
    const items = entries.slice(0, 6).map((entry) => {
      const videoId = readTag(entry, 'yt:videoId');
      return {
        videoId,
        title: readTag(entry, 'title'),
        published: readTag(entry, 'published'),
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      };
    }).filter((item) => item.videoId && item.title);

    return Response.json(
      { items, updatedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, max-age=900, s-maxage=1800' } }
    );
  } catch {
    return Response.json(
      { items: [], error: 'YouTube updates are temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
