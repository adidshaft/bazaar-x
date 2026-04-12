/* global URL */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';

const distDir = new URL('../dist', import.meta.url);

const updateRelativeSpecifiers = (source) =>
  source.replace(
    /((?:from|export\s+\*)\s*['"])(\.{1,2}\/[^'".]+)(['"])/g,
    (_, prefix, specifier, suffix) => `${prefix}${specifier}.js${suffix}`,
  );

const walk = (directoryUrl) => {
  for (const entry of readdirSync(directoryUrl)) {
    const entryPath = new URL(entry, `${directoryUrl.href.endsWith('/') ? directoryUrl.href : `${directoryUrl.href}/`}`);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      walk(entryPath);
      continue;
    }

    if (!entry.endsWith('.js')) {
      continue;
    }

    const contents = readFileSync(entryPath, 'utf8');
    writeFileSync(entryPath, updateRelativeSpecifiers(contents));
  }
};

walk(distDir);
