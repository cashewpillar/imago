#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const swPath = path.join(root, 'sw.js');
const indexPath = path.join(root, 'index.html');

const htmlHeadRequirements = [
  {
    pattern: /<meta[^>]+name=["']theme-color["']/i,
    tag: '<meta name="theme-color" content="#f7f6f2">'
  },
  {
    pattern: /<meta[^>]+name=["']mobile-web-app-capable["']/i,
    tag: '<meta name="mobile-web-app-capable" content="yes">'
  },
  {
    pattern: /<meta[^>]+name=["']apple-mobile-web-app-capable["']/i,
    tag: '<meta name="apple-mobile-web-app-capable" content="yes">'
  },
  {
    pattern: /<meta[^>]+name=["']apple-mobile-web-app-status-bar-style["']/i,
    tag: '<meta name="apple-mobile-web-app-status-bar-style" content="default">'
  },
  {
    pattern: /<meta[^>]+name=["']apple-mobile-web-app-title["']/i,
    tag: '<meta name="apple-mobile-web-app-title" content="imago">'
  },
  {
    pattern: /<link[^>]+rel=["']manifest["']/i,
    tag: '<link rel="manifest" href="manifest.webmanifest">'
  },
  {
    pattern: /<link[^>]+rel=["']icon["'][^>]+imago-icon\.svg/i,
    tag: '<link rel="icon" href="icons/imago-icon.svg" type="image/svg+xml">'
  },
  {
    pattern: /<link[^>]+rel=["']apple-touch-icon["']/i,
    tag: '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">'
  }
];

const htmlBodyScript = '<script src="pwa-register.js"></script>';
const generatedIndexStart = '            <!-- BEGIN GENERATED PROTOTYPE LINKS -->';
const generatedIndexEnd = '            <!-- END GENERATED PROTOTYPE LINKS -->';

function getRootHtmlFiles() {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.html'))
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function getHtmlTitle(content, file) {
  const match = content.match(/<title>([^<]+)<\/title>/i);
  if (match) {
    return match[1].trim();
  }

  return file.replace(/\.html$/i, '');
}

function getMetaLabel(file) {
  return file.replace(/\.html$/i, '').replace(/-/g, ' ');
}

function ensureHeadTags(content, file) {
  const missingTags = htmlHeadRequirements
    .filter(requirement => !requirement.pattern.test(content))
    .map(requirement => requirement.tag);

  if (!missingTags.length) {
    return { changed: false, content };
  }

  const block = `${missingTags.join('\n')}\n`;
  const updated = content.replace(/<\/head>/i, `${block}</head>`);

  if (updated === content) {
    return { changed: false, content };
  }

  console.log(`Added PWA head tags to ${file}`);
  return { changed: true, content: updated };
}

function ensureRegisterScript(content, file) {
  if (content.includes(htmlBodyScript)) {
    return { changed: false, content };
  }

  const updated = content.replace(/<\/body>/i, `  ${htmlBodyScript}\n</body>`);
  if (updated === content) {
    return { changed: false, content };
  }

  console.log(`Added service worker bootstrap to ${file}`);
  return { changed: true, content: updated };
}

function updateHtmlFile(file) {
  const filePath = path.join(root, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  const headResult = ensureHeadTags(content, file);
  content = headResult.content;
  changed = changed || headResult.changed;

  const scriptResult = ensureRegisterScript(content, file);
  content = scriptResult.content;
  changed = changed || scriptResult.changed;

  if (changed) {
    fs.writeFileSync(filePath, content);
  }
}

function updateServiceWorker(htmlFiles) {
  const sw = fs.readFileSync(swPath, 'utf8');
  const generatedBlock = htmlFiles
    .map(file => `  './${file}',`)
    .join('\n');
  const markerPattern = /(\s*\/\/ BEGIN GENERATED HTML PAGES\n)[\s\S]*?(\n\s*\/\/ END GENERATED HTML PAGES)/;

  if (!markerPattern.test(sw)) {
    throw new Error('Could not find generated HTML markers in sw.js');
  }

  const next = sw.replace(
    markerPattern,
    `$1${generatedBlock}$2`
  );

  if (next !== sw) {
    fs.writeFileSync(swPath, next);
    console.log(`Updated sw.js with ${htmlFiles.length} HTML pages`);
  }
}

function updateIndex(htmlFiles) {
  const rawIndex = fs.readFileSync(indexPath, 'utf8');
  const generatedPattern = new RegExp(
    `\\n?\\s*<!-- BEGIN GENERATED PROTOTYPE LINKS -->[\\s\\S]*?<!-- END GENERATED PROTOTYPE LINKS -->`,
    'i'
  );
  const withoutGenerated = rawIndex.replace(generatedPattern, '');
  const linkedFiles = new Set(
    [...withoutGenerated.matchAll(/<a\s+href="([^"]+\.html)"/gi)].map(match => match[1])
  );

  const generatedFiles = htmlFiles.filter(file => file !== 'index.html' && !linkedFiles.has(file));
  const generatedItems = generatedFiles.map(file => {
    const content = fs.readFileSync(path.join(root, file), 'utf8');
    const title = getHtmlTitle(content, file);
    const meta = getMetaLabel(file);

    return [
      '            <li>',
      `                <a href="${file}">`,
      `                    <span>${title}</span>`,
      `                    <span class="meta">${meta}</span>`,
      '                </a>',
      '            </li>'
    ].join('\n');
  });

  const generatedBlock = [
    generatedIndexStart,
    ...generatedItems,
    generatedIndexEnd
  ].join('\n');

  const replacement = generatedItems.length ? `\n${generatedBlock}\n` : '\n';
  const nextIndex = generatedPattern.test(rawIndex)
    ? rawIndex.replace(generatedPattern, replacement.trimEnd())
    : withoutGenerated.replace(/(\s*<\/ul>)/i, `${replacement}$1`);

  if (nextIndex !== rawIndex) {
    fs.writeFileSync(indexPath, nextIndex);
    console.log(`Updated index.html with ${generatedFiles.length} generated launcher links`);
  }
}

function main() {
  const htmlFiles = getRootHtmlFiles();

  htmlFiles.forEach(updateHtmlFile);
  updateServiceWorker(htmlFiles);
  updateIndex(htmlFiles);

  console.log('\nRegistered HTML pages:');
  htmlFiles.forEach(file => console.log(`- ${file}`));
}

main();
