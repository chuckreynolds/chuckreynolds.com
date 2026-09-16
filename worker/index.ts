// Content negotiation for the markdown twin. Everything else about this site is
// static assets served straight from the edge; `run_worker_first` in
// wrangler.jsonc limits this Worker to the one path that has two representations.

interface Env {
  ASSETS: Fetcher;
}

interface AcceptEntry {
  type: string;
  q: number;
}

function parseAccept(header: string): AcceptEntry[] {
  return header
    .split(',')
    .map((part) => {
      const [type, ...params] = part.trim().split(';');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const q = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
      return { type: type.trim().toLowerCase(), q: Number.isNaN(q) ? 0 : q };
    })
    .filter((entry) => entry.type && entry.q > 0);
}

function qualityFor(entries: AcceptEntry[], type: string, subtype: string): number {
  let best = 0;
  for (const entry of entries) {
    const matches =
      entry.type === `${type}/${subtype}` ||
      entry.type === `${type}/*` ||
      entry.type === '*/*';
    if (matches && entry.q > best) best = entry.q;
  }
  return best;
}

function wantsMarkdown(header: string | null): boolean {
  if (!header) return false;
  const entries = parseAccept(header);
  const markdown = qualityFor(entries, 'text', 'markdown');
  if (markdown === 0) return false;
  // A browser sending `*/*` or `text/*` matches markdown too, so markdown has to
  // actually beat HTML before we serve it. Ties go to HTML.
  return markdown > qualityFor(entries, 'text', 'html');
}

// RFC 8288. The page already carries <link rel="alternate"> in its head, but that
// is only discoverable by parsing the HTML. As a header it survives a HEAD request
// and reaches clients that never look at the body.
const TO_MARKDOWN = '</index.md>; rel="alternate"; type="text/markdown"';
const TO_HTML = '</>; rel="alternate"; type="text/html"';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Advertised in both directions, so discovery works whichever representation
    // an agent happens to land on first.
    if (url.pathname === '/index.md') {
      const asset = await env.ASSETS.fetch(request);
      const markdown = new Response(asset.body, asset);
      markdown.headers.append('Link', TO_HTML);
      return markdown;
    }

    const negotiable = url.pathname === '/' || url.pathname === '/index.html';

    if (!negotiable || !wantsMarkdown(request.headers.get('Accept'))) {
      const response = await env.ASSETS.fetch(request);
      if (!negotiable) return response;
      // The HTML representation of a negotiated URL still has to declare that it
      // varies, or a cache could hand it to a client that asked for markdown.
      const html = new Response(response.body, response);
      html.headers.append('Vary', 'Accept');
      html.headers.append('Link', TO_MARKDOWN);
      return html;
    }

    const markdown = await env.ASSETS.fetch(new URL('/index.md', url));
    const response = new Response(markdown.body, markdown);
    response.headers.set('Content-Type', 'text/markdown; charset=utf-8');
    response.headers.append('Vary', 'Accept');
    response.headers.set('Content-Location', '/index.md');
    response.headers.append('Link', TO_HTML);
    return response;
  },
};
