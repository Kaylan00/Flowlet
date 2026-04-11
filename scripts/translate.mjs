#!/usr/bin/env node
/**
 * Auto-translate script for Flowlet i18n
 *
 * Uses google-translate-api-x (free, no API key) to translate
 * all English keys in translate.service.ts to Portuguese.
 *
 * Usage:
 *   node scripts/translate.mjs              # translate missing keys only
 *   node scripts/translate.mjs --all        # re-translate all keys
 *   node scripts/translate.mjs --dry-run    # preview without writing
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import translate from 'google-translate-api-x';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVICE_PATH = resolve(
  __dirname,
  '../src/app/core/services/translate.service.ts',
);

const args = process.argv.slice(2);
const reAll = args.includes('--all');
const dryRun = args.includes('--dry-run');

// ── 1. Read the current file ────────────────────────────────────────────
const source = readFileSync(SERVICE_PATH, 'utf-8');

// Extract existing PT dictionary entries: 'key': 'value'
const entryRegex = /^\s*'([^']+)'\s*:\s*'([^']*)'/gm;
const existing = new Map();
let m;
while ((m = entryRegex.exec(source)) !== null) {
  existing.set(m[1], m[2]);
}

const keys = [...existing.keys()];
console.log(`Found ${keys.length} translation keys.\n`);

// ── 2. Decide which keys to translate ───────────────────────────────────
// In normal mode, only translate keys that don't have a value yet (new keys)
// In --all mode, re-translate everything from scratch
const toTranslate = reAll ? keys : keys.filter((k) => !existing.has(k) || existing.get(k) === '');

// ── 3. Translate via Google Translate API (batched) ─────────────────────
const BATCH_SIZE = 30;
const translations = new Map();

async function translateBatch(batch) {
  try {
    const results = await translate(batch, { from: 'en', to: 'pt' });
    // google-translate-api-x returns an array when given an array
    const arr = Array.isArray(results) ? results : [results];
    for (let i = 0; i < batch.length; i++) {
      translations.set(batch[i], arr[i].text);
    }
  } catch (err) {
    console.error(`  ⚠ Batch translation failed, trying one by one...`);
    for (const key of batch) {
      try {
        const res = await translate(key, { from: 'en', to: 'pt' });
        translations.set(key, res.text);
      } catch (e) {
        console.error(`  ✗ Failed to translate: "${key}" — keeping existing`);
        translations.set(key, existing.get(key) || key);
      }
    }
  }
}

console.log('Translating via Google Translate API...\n');

for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
  const batch = toTranslate.slice(i, i + BATCH_SIZE);
  const progress = Math.min(i + BATCH_SIZE, toTranslate.length);
  process.stdout.write(`  [${progress}/${toTranslate.length}] translating...`);
  await translateBatch(batch);
  console.log(' done');
  // small delay to avoid rate limiting
  if (i + BATCH_SIZE < toTranslate.length) {
    await new Promise((r) => setTimeout(r, 500));
  }
}

// ── 4. Build the new PT dictionary ──────────────────────────────────────
let changed = 0;
let kept = 0;

const lines = [];
// Preserve the section comments from the original file
const sectionRegex =
  /^(\s*\/\/\s*---.*?---)\s*$|^\s*'([^']+)'\s*:\s*'([^']*)'\s*,?\s*$/gm;
let match;
const ordered = [];

// Parse the original file structure to preserve comments and ordering
const dictStart = source.indexOf("const PT: Record<string, string> = {");
const dictEnd = source.indexOf("};", dictStart);
const dictBlock = source.substring(dictStart, dictEnd + 2);

const linesList = dictBlock.split('\n');
for (const line of linesList) {
  const commentMatch = line.match(/^\s*(\/\/\s*---.*?---)\s*$/);
  if (commentMatch) {
    ordered.push({ type: 'comment', value: commentMatch[1] });
    continue;
  }
  const entryMatch = line.match(/^\s*'([^']+)'\s*:\s*'([^']*)'/);
  if (entryMatch) {
    const key = entryMatch[1];
    const oldVal = entryMatch[2];
    const newVal = translations.get(key) || oldVal;

    if (!reAll && existing.has(key) && oldVal !== '') {
      // Keep all existing non-empty translations (including intentional same-as-key like "Slack")
      ordered.push({ type: 'entry', key, value: oldVal });
      kept++;
    } else {
      // New key or empty value — use API translation
      const finalVal = translations.get(key) || newVal || oldVal;
      ordered.push({ type: 'entry', key, value: finalVal });
      if (finalVal !== oldVal) changed++;
      else kept++;
    }
  }
}

// ── 5. Show diff ────────────────────────────────────────────────────────
console.log(`\nResults:`);
console.log(`  ${changed} translations updated`);
console.log(`  ${kept} translations kept`);

if (changed > 0) {
  console.log(`\nChanges:`);
  for (const item of ordered) {
    if (item.type !== 'entry') continue;
    const oldVal = existing.get(item.key);
    if (oldVal !== item.value) {
      console.log(`  "${item.key}"`);
      console.log(`    - ${oldVal}`);
      console.log(`    + ${item.value}`);
    }
  }
}

if (dryRun) {
  console.log('\n--dry-run: no files were modified.');
  process.exit(0);
}

// ── 6. Write back ───────────────────────────────────────────────────────
if (changed === 0) {
  console.log('\nNo changes needed.');
  process.exit(0);
}

// Rebuild the PT dictionary block
let newDict = "const PT: Record<string, string> = {\n";
for (const item of ordered) {
  if (item.type === 'comment') {
    newDict += `  ${item.value}\n`;
  } else {
    // Escape single quotes in value
    const escaped = item.value.replace(/'/g, "\\'");
    newDict += `  '${item.key}': '${escaped}',\n`;
  }
}
newDict += "};";

const newSource = source.substring(0, dictStart) + newDict + source.substring(dictEnd + 2);

writeFileSync(SERVICE_PATH, newSource, 'utf-8');
console.log(`\n✓ Updated ${SERVICE_PATH}`);
