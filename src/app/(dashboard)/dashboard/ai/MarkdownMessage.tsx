import React from 'react';
import { parseMarkdown, isSafeHref } from './markdown';
import styles from './ai.module.css';

/**
 * Komponen tampilan untuk balasan AI berupa markdown.
 *
 * Semua elemen dibuat lewat React (tanpa dangerouslySetInnerHTML), sehingga
 * aman terhadap HTML apa pun yang mungkin muncul di output model.
 */

function renderInline(text: string, keyPrefix: string, s: Record<string, string>): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Pattern matches:
  // 1. Markdown link: [label](url)
  // 2. Bare wa.me URL: https://wa.me/...
  // 3. Bold: **text**
  // 4. Inline code: `text`
  // 5. Italic: *text*
  const pattern = /(\[[^\]]+\]\(https?:\/\/[^)]+\)|https:\/\/wa\.me\/[^\s<>"')]+|\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g;
  let lastIndex = 0;
  let index = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-${index}`;
    index += 1;

    // Markdown inline link: [label](https://...)
    if (token.startsWith('[')) {
      const bracketEnd = token.indexOf(']');
      const label = token.slice(1, bracketEnd);
      const href = token.slice(bracketEnd + 2, -1);
      if (isSafeHref(href)) {
        const isWa = href.includes('wa.me');
        nodes.push(
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className={isWa ? (s.whatsappLink || s.inlineLink) : s.inlineLink}
          >
            {isWa && (
              <svg
                className={s.whatsappIcon}
                viewBox="0 0 24 24"
                fill="currentColor"
                width="15"
                height="15"
                aria-hidden="true"
              >
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.669-.699c.969.539 1.761.815 2.791.815 3.182 0 5.767-2.586 5.768-5.766 0-3.18-2.586-5.767-5.768-5.801zm3.377 8.212c-.14.394-.71.728-1.02.775-.29.043-.655.086-2.127-.525-1.884-.78-3.09-2.709-3.184-2.833-.094-.124-.766-1.021-.766-1.947 0-.926.486-1.381.659-1.569.173-.188.378-.235.504-.235.126 0 .252.001.362.007.116.006.27-.044.422.321.157.377.534 1.303.58 1.397.047.094.078.204.016.329-.063.125-.094.204-.188.314-.094.11-.197.246-.282.33-.094.094-.192.196-.083.383.11.188.487.804 1.045 1.301.718.639 1.323.837 1.511.931.188.094.298.079.408-.047.11-.125.47-.549.596-.737.125-.188.251-.157.423-.094.173.063 1.097.517 1.285.611.188.094.314.141.36.22.047.078.047.455-.093.849z" />
                <path d="M12 2C6.48 2 2 6.48 2 12c0 1.83.49 3.55 1.34 5.03L2 22l5.12-1.31C8.57 21.49 10.23 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18.2c-1.63 0-3.15-.46-4.46-1.26l-.32-.2-3.03.77.81-2.95-.21-.34A8.17 8.17 0 013.8 12c0-4.52 3.68-8.2 8.2-8.2 4.52 0 8.2 3.68 8.2 8.2 0 4.52-3.68 8.2-8.2 8.2z" />
              </svg>
            )}
            <span>{label}</span>
          </a>
        );
      } else {
        nodes.push(token);
      }
    } else if (token.startsWith('https://wa.me/')) {
      // Bare WhatsApp URL
      nodes.push(
        <a
          key={key}
          href={token}
          target="_blank"
          rel="noreferrer noopener"
          className={s.whatsappLink || s.inlineLink}
        >
          <svg
            className={s.whatsappIcon}
            viewBox="0 0 24 24"
            fill="currentColor"
            width="15"
            height="15"
            aria-hidden="true"
          >
            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.669-.699c.969.539 1.761.815 2.791.815 3.182 0 5.767-2.586 5.768-5.766 0-3.18-2.586-5.767-5.768-5.801zm3.377 8.212c-.14.394-.71.728-1.02.775-.29.043-.655.086-2.127-.525-1.884-.78-3.09-2.709-3.184-2.833-.094-.124-.766-1.021-.766-1.947 0-.926.486-1.381.659-1.569.173-.188.378-.235.504-.235.126 0 .252.001.362.007.116.006.27-.044.422.321.157.377.534 1.303.58 1.397.047.094.078.204.016.329-.063.125-.094.204-.188.314-.094.11-.197.246-.282.33-.094.094-.192.196-.083.383.11.188.487.804 1.045 1.301.718.639 1.323.837 1.511.931.188.094.298.079.408-.047.11-.125.47-.549.596-.737.125-.188.251-.157.423-.094.173.063 1.097.517 1.285.611.188.094.314.141.36.22.047.078.047.455-.093.849z" />
            <path d="M12 2C6.48 2 2 6.48 2 12c0 1.83.49 3.55 1.34 5.03L2 22l5.12-1.31C8.57 21.49 10.23 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18.2c-1.63 0-3.15-.46-4.46-1.26l-.32-.2-3.03.77.81-2.95-.21-.34A8.17 8.17 0 013.8 12c0-4.52 3.68-8.2 8.2-8.2 4.52 0 8.2 3.68 8.2 8.2 0 4.52-3.68 8.2-8.2 8.2z" />
          </svg>
          <span>Chat Admin via WhatsApp</span>
        </a>
      );
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className={s.inlineCode}>
          {token.slice(1, -1)}
        </code>
      );
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

const BR_RE = /<\s*br\s*\/?\s*>/i;

/**
 * Memecah teks pada tag <br> menjadi elemen <br>.
 * Model kadang memakai <br> di dalam sel tabel, dan tag itu akan tampil
 * apa adanya bila tidak dipecah.
 */
function withLineBreaks(text: string, keyPrefix: string, s: Record<string, string>): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const parts = text.split(BR_RE);

  parts.forEach((part, i) => {
    if (i > 0) nodes.push(<br key={`${keyPrefix}-br${i}`} />);
    if (part !== '') {
      nodes.push(
        <React.Fragment key={`${keyPrefix}-p${i}`}>{renderInline(part, `${keyPrefix}-p${i}`, s)}</React.Fragment>
      );
    }
  });

  return nodes;
}

export function MarkdownMessage({
  content,
  customStyles,
}: {
  content: string;
  customStyles?: Record<string, string>;
}) {
  const s = customStyles || styles;
  const blocks = parseMarkdown(content);

  return (
    <div className={s.markdown}>
      {blocks.map((block, index) => {
        const key = `b${index}`;

        switch (block.kind) {
          case 'code':
            return (
              <pre key={key} className={s.codeBlock} data-lang={block.lang}>
                <code>{block.lines.join('\n')}</code>
              </pre>
            );

          case 'heading': {
            const Tag = (['h3', 'h4', 'h5', 'h6', 'h6', 'h6'] as const)[block.level - 1];
            return <Tag key={key}>{withLineBreaks(block.text, key, s)}</Tag>;
          }

          case 'ul':
            return (
              <ul key={key}>
                {block.items.map((item, j) => (
                  <li key={`${key}-${j}`}>{withLineBreaks(item, `${key}-${j}`, s)}</li>
                ))}
              </ul>
            );

          case 'ol':
            return (
              <ol key={key}>
                {block.items.map((item, j) => (
                  <li key={`${key}-${j}`}>{withLineBreaks(item, `${key}-${j}`, s)}</li>
                ))}
              </ol>
            );

          case 'table':
            return (
              <div key={key} className={s.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      {block.header.map((cell, j) => (
                        <th key={`${key}-h${j}`}>{withLineBreaks(cell, `${key}-h${j}`, s)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={`${key}-r${r}`}>
                        {row.map((cell, c) => (
                          <td key={`${key}-r${r}c${c}`}>{withLineBreaks(cell, `${key}-r${r}c${c}`, s)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'quote':
            return (
              <blockquote key={key}>
                {block.lines.map((line, j) => (
                  <p key={`${key}-${j}`}>{withLineBreaks(line, `${key}-${j}`, s)}</p>
                ))}
              </blockquote>
            );

          case 'hr':
            return <hr key={key} />;

          case 'p':
            return <p key={key}>{withLineBreaks(block.text, key, s)}</p>;

          default:
            return null;
        }
      })}
    </div>
  );
}