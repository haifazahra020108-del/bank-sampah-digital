/**
 * Parser markdown ringan, tanpa dependensi dan tanpa import CSS.
 *
 * Balasan AI memakai markdown (judul, daftar, tabel, blok kode). Tanpa
 * parser ini markdown hanya tampil sebagai teks mentah. Dipisah dari
 * komponen tampilan supaya bisa diuji tanpa bundler Next.js.
 */

export type MarkdownBlock =
  | { kind: 'code'; lang: string; lines: string[] }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'table'; header: string[]; rows: string[][] }
  | { kind: 'quote'; lines: string[] }
  | { kind: 'hr' }
  | { kind: 'p'; text: string };

/** Token emitted by the inline parser for a Markdown link `[label](url)`. */
export type InlineLinkToken = { kind: 'link'; label: string; href: string };

const FENCE_RE = /^```(\w*)\s*$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const UL_RE = /^\s*[-*+]\s+(.*)$/;
const OL_RE = /^\s*\d+[.)]\s+(.*)$/;
const HR_RE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;
const TABLE_SEPARATOR_RE = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/;

/**
 * Allow-list of URL prefixes that inline links may point to.
 * Only https:// links are accepted; bare http:// or javascript: are blocked.
 */
export const ALLOWED_LINK_PREFIXES = ['https://'] as const;

/**
 * Returns true when `href` is safe to render as an anchor.
 * Only https:// URLs are permitted to prevent javascript: or data: injection.
 */
export function isSafeHref(href: string): boolean {
  return ALLOWED_LINK_PREFIXES.some((p) => href.startsWith(p));
}

function splitTableRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((c) => c.trim());
}

function isTableStart(lines: string[], index: number): boolean {
  return (
    lines[index].trim().startsWith('|') &&
    index + 1 < lines.length &&
    TABLE_SEPARATOR_RE.test(lines[index + 1]) &&
    lines[index + 1].includes('-')
  );
}

export function parseMarkdown(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    const fence = line.match(FENCE_RE);
    if (fence) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ kind: 'code', lang: fence[1] ?? '', lines: body });
      continue;
    }

    if (isTableStart(lines, i)) {
      const header = splitTableRow(lines[i]);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      blocks.push({ kind: 'table', header, rows });
      continue;
    }

    if (HR_RE.test(line)) {
      blocks.push({ kind: 'hr' });
      i += 1;
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] });
      i += 1;
      continue;
    }

    if (UL_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(UL_RE);
        if (!m) break;
        items.push(m[1]);
        i += 1;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }

    if (OL_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(OL_RE);
        if (!m) break;
        items.push(m[1]);
        i += 1;
      }
      blocks.push({ kind: 'ol', items });
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(QUOTE_RE);
        if (!m) break;
        items.push(m[1]);
        i += 1;
      }
      blocks.push({ kind: 'quote', lines: items });
      continue;
    }

    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !FENCE_RE.test(lines[i]) &&
      !HEADING_RE.test(lines[i]) &&
      !UL_RE.test(lines[i]) &&
      !OL_RE.test(lines[i]) &&
      !HR_RE.test(lines[i]) &&
      !QUOTE_RE.test(lines[i]) &&
      !isTableStart(lines, i)
    ) {
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push({ kind: 'p', text: paragraph.join('\n') });
  }

  return blocks;
}