import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { onRequestGet } from '../functions/api/education-news.js';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDirectory, '../public/data/education-news.json');

const readExistingSnapshot = async () => {
  const existing = JSON.parse(await readFile(outputPath, 'utf8'));
  if (!Array.isArray(existing.items) || !existing.items.length) throw new Error('Saved snapshot is empty');
  return existing;
};

try {
  const response = await onRequestGet();
  if (!response.ok) throw new Error(`Feed refresh returned ${response.status}`);

  const data = await response.json();
  if (!Array.isArray(data.items) || !data.items.length) throw new Error('Feed refresh returned no articles');

  const snapshot = `${JSON.stringify({ items: data.items, updatedAt: data.updatedAt || new Date().toISOString() }, null, 2)}\n`;
  await mkdir(dirname(outputPath), { recursive: true });

  let existing = '';
  try {
    existing = await readFile(outputPath, 'utf8');
  } catch {}

  if (existing !== snapshot) await writeFile(outputPath, snapshot, 'utf8');
  console.log(`Education news snapshot contains ${data.items.length} articles.`);
} catch (error) {
  try {
    const existing = await readExistingSnapshot();
    console.warn(`News refresh was unavailable; keeping ${existing.items.length} saved articles.`);
  } catch {
    throw error;
  }
}
