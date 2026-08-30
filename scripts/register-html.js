#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const swPath = path.join(root, 'sw.js');
const indexPath = path.join(root, 'index.html');

function getRootHtmlFiles() {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.html') && entry.name !== 'index.html' && entry.name !== 'archive.html' && entry.name !== 'seldom.html')
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function getFilesFromSubdir(dirName) {
  const dir = path.join(root, dirName);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.html'))
    .map(entry => `${dirName}/${entry.name}`)
    .sort((a, b) => a.localeCompare(b));
}

function getArchiveHtmlFiles() {
  return getFilesFromSubdir('archive');
}

function getSeldomHtmlFiles() {
  return getFilesFromSubdir('seldom');
}

function getHeadRequirementsForFile(file) {
  const isNested = file.includes('/');
  const prefix = isNested ? '../' : './';
  return [
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
      tag: `<link rel="manifest" href="${prefix}manifest.webmanifest">`
    },
    {
      pattern: /<link[^>]+rel=["']icon["'][^>]+imago-icon\.svg/i,
      tag: `<link rel="icon" href="${prefix}icons/imago-icon.svg" type="image/svg+xml">`
    },
    {
      pattern: /<link[^>]+rel=["']apple-touch-icon["']/i,
      tag: `<link rel="apple-touch-icon" href="${prefix}icons/apple-touch-icon.png">`
    }
  ];
}

function getBodyScriptForFile(file) {
  const isNested = file.includes('/');
  const prefix = isNested ? '../' : '';
  return `<script src="${prefix}pwa-register.js"></script>`;
}

const generatedIndexStart = '            <!-- BEGIN GENERATED PROTOTYPE LINKS -->';
const generatedIndexEnd = '            <!-- END GENERATED PROTOTYPE LINKS -->';

function getHtmlTitle(content, file) {
  const match = content.match(/<title>([^<]+)<\/title>/i);
  if (match) {
    return match[1].trim();
  }

  return file.replace(/^(archive|seldom)\//i, '').replace(/\.html$/i, '');
}

function getMetaLabel(file) {
  return file.replace(/^(archive|seldom)\//i, '').replace(/\.html$/i, '').replace(/-/g, ' ');
}

function updateHtmlFile(file) {
  const filePath = path.join(root, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  const requirements = getHeadRequirementsForFile(file);
  const missingTags = requirements
    .filter(req => !req.pattern.test(content))
    .map(req => req.tag);

  if (missingTags.length) {
    const block = `${missingTags.join('\n')}\n`;
    content = content.replace(/<\/head>/i, `${block}</head>`);
    changed = true;
    console.log(`Added PWA head tags to ${file}`);
  }

  const scriptTag = getBodyScriptForFile(file);
  if (!content.includes('pwa-register.js')) {
    content = content.replace(/<\/body>/i, `  ${scriptTag}\n</body>`);
    changed = true;
    console.log(`Added service worker bootstrap to ${file}`);
  }

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

function updateLaunchers(rootFiles, archiveFiles, seldomFiles) {
  const rawIndex = fs.readFileSync(indexPath, 'utf8');
  const generatedPattern = new RegExp(
    `\\n?\\s*<!-- BEGIN GENERATED PROTOTYPE LINKS -->[\\s\\S]*?<!-- END GENERATED PROTOTYPE LINKS -->`,
    'i'
  );

  const launcherPages = ['index.html', 'archive.html', 'seldom.html'];

  // Helper to generate the list items for a set of files
  function generateListItems(files) {
    const withoutGenerated = rawIndex.replace(generatedPattern, '');
    const linkedFiles = new Set(
      [...withoutGenerated.matchAll(/<a\s+href="([^"]+\.html)"/gi)].map(match => match[1])
    );

    const generatedFiles = files.filter(file => !launcherPages.includes(file) && !linkedFiles.has(file));
    return generatedFiles.map(file => {
      const diskPath = path.join(root, file);
      const content = fs.readFileSync(diskPath, 'utf8');
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
  }

  function buildPage(items, href) {
    const block = [
      generatedIndexStart,
      ...items,
      generatedIndexEnd
    ].join('\n');
    const replacement = items.length ? `\n${block}\n` : '\n';
    let next = generatedPattern.test(rawIndex)
      ? rawIndex.replace(generatedPattern, replacement.trimEnd())
      : rawIndex.replace(/(\s*<\/ul>)/i, `${replacement}$1`);

    // Set this page's tab as active, all others inactive
    next = next
      .replace(/class="tab\s+active"/g, 'class="tab"')
      .replace(new RegExp(`href="${href}"\\s+class="tab"`), `href="${href}" class="tab active"`);

    return next;
  }

  const rootItems = generateListItems(rootFiles);
  const archiveItems = generateListItems(archiveFiles);
  const seldomItems = generateListItems(seldomFiles);

  // 1. Update index.html
  const nextIndex = buildPage(rootItems, 'index.html');
  if (nextIndex !== rawIndex) {
    fs.writeFileSync(indexPath, nextIndex);
    console.log(`Updated index.html with ${rootItems.length} active launcher links`);
  }

  // 2. Update/create archive.html
  const nextArchive = buildPage(archiveItems, 'archive.html');
  const archivePath = path.join(root, 'archive.html');
  const rawArchive = fs.existsSync(archivePath) ? fs.readFileSync(archivePath, 'utf8') : '';
  if (nextArchive !== rawArchive) {
    fs.writeFileSync(archivePath, nextArchive);
    console.log(`Updated archive.html with ${archiveItems.length} archived launcher links`);
  }

  // 3. Update/create seldom.html
  const nextSeldom = buildPage(seldomItems, 'seldom.html');
  const seldomPath = path.join(root, 'seldom.html');
  const rawSeldom = fs.existsSync(seldomPath) ? fs.readFileSync(seldomPath, 'utf8') : '';
  if (nextSeldom !== rawSeldom) {
    fs.writeFileSync(seldomPath, nextSeldom);
    console.log(`Updated seldom.html with ${seldomItems.length} seldom launcher links`);
  }
}

function main() {
  const rootFiles = getRootHtmlFiles();
  const archiveFiles = getArchiveHtmlFiles();
  const seldomFiles = getSeldomHtmlFiles();
  const allFiles = [...rootFiles, ...archiveFiles, ...seldomFiles];

  // Process all files for PWA injection (including index.html, archive.html and seldom.html)
  const allFilesToUpdate = ['index.html', 'archive.html', 'seldom.html', ...allFiles];
  allFilesToUpdate.forEach(file => {
    if (fs.existsSync(path.join(root, file))) {
      updateHtmlFile(file);
    }
  });

  updateServiceWorker(['index.html', 'archive.html', 'seldom.html', ...allFiles]);
  updateLaunchers(rootFiles, archiveFiles, seldomFiles);

  console.log('\nRegistered HTML pages:');
  console.log('Root:');
  rootFiles.forEach(file => console.log(`- ${file}`));
  console.log('Seldom:');
  seldomFiles.forEach(file => console.log(`- ${file}`));
  console.log('Archive:');
  archiveFiles.forEach(file => console.log(`- ${file}`));
}

main();
