import { readFile, writeFile } from 'node:fs/promises';
import TurndownService from 'turndown';

// Builds dist/index.md from the already-rendered dist/index.html rather than from
// a second copy of the copy. The markdown twin is a projection of the real page,
// so it cannot drift: edit index.astro and the twin follows on the next build.

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  emDelimiter: '_',
});

// Social links are an inline SVG wrapped in an anchor. Stripping the SVG leaves an
// empty link, so the accessible name is the only text those anchors ever had.
turndown.addRule('labelledIconLink', {
  filter: (node) =>
    node.nodeName === 'A' && !node.textContent.trim() && node.getAttribute('aria-label'),
  replacement: (_content, node) =>
    `[${node.getAttribute('aria-label')}](${node.getAttribute('href')})`,
});

function stripElement(html, tag) {
  return html.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'gi'), '');
}

function yamlString(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export default function markdownTwin() {
  return {
    name: 'markdown-twin',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const htmlPath = new URL('index.html', dir);
        const html = await readFile(htmlPath, 'utf8');

        // The page's own JSON-LD already carries the canonical metadata, so the twin
        // reads it from there instead of re-deriving it.
        const ldMatch = html.match(
          /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
        );
        if (!ldMatch) throw new Error('markdown-twin: no JSON-LD found in index.html');
        const graph = JSON.parse(ldMatch[1])['@graph'];
        const page = graph.find((node) => node['@type'] === 'ProfilePage');
        if (!page) throw new Error('markdown-twin: no ProfilePage node in JSON-LD');

        const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/);
        if (!mainMatch) throw new Error('markdown-twin: no <main> found in index.html');

        // The headshot and the theme toggle are presentation with no markdown meaning.
        let body = mainMatch[1];
        body = stripElement(body, 'figure');
        body = stripElement(body, 'svg');
        body = stripElement(body, 'script');
        // A "view as markdown" link has nothing to offer a reader already holding
        // the markdown, so the page opts such elements out by attribute.
        body = body.replace(/<(\w+)\b[^>]*\sdata-html-only\b[^>]*>[\s\S]*?<\/\1>/gi, '');

        const frontmatter = [
          '---',
          `title: ${yamlString(page.name)}`,
          `description: ${yamlString(page.description)}`,
          `canonical: ${yamlString(page.url)}`,
          `dateModified: ${yamlString(page.dateModified)}`,
          '---',
        ].join('\n');

        // Turndown pads list markers out to four columns; normalize to one space.
        const content = turndown
          .turndown(body)
          .replace(/^(\s*)-\s+/gm, '$1- ')
          .trim();

        const markdown = `${frontmatter}\n\n${content}\n`;
        await writeFile(new URL('index.md', dir), markdown, 'utf8');
        logger.info(`\`index.md\` created at \`dist\` (${markdown.length} bytes)`);
      },
    },
  };
}
