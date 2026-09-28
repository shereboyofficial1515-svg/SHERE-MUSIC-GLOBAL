import { Fragment, memo } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';

/**
 * Small Markdown renderer for the documentation. It builds React elements
 * (never injects HTML), so article text can't run scripts. Supports:
 * ## / ### headings, paragraphs, - and 1. lists (one nested level),
 * **bold**, _italic_, `code`, [links](…), ![images](…), tables, ``` code
 * blocks, --- rules and callouts: "> **Tip:** …", "> **Note:** …",
 * "> **Important:** …".
 */

export const slugify = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[`*_[\]()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** h2/h3 headings for the "On this page" list. */
export function headingsOf(body) {
  return (body.match(/^#{2,3} .+$/gm) || []).map((line) => {
    const level = line.startsWith('###') ? 3 : 2;
    const text = line.replace(/^#{2,3} /, '').replace(/[*_`]/g, '');
    return { level, text, id: slugify(text) };
  });
}

function DocLink({ href, children }) {
  if (/^https?:\/\//i.test(href) || href.startsWith('mailto:')) {
    return (
      <a href={href} target={href.startsWith('mailto:') ? undefined : '_blank'} rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return <Link to={href}>{children}</Link>;
}

// Inline: images, links, code, bold, italic, keyboard keys ([[Space]]).
const INLINE = /(!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|(?<![A-Za-z0-9])_[^_\s][^_]*_(?![A-Za-z0-9])|\[\[[^\]]+\]\])/g;

function inline(text, ctx, keyBase = 'i') {
  const parts = String(text).split(INLINE).filter((p) => p !== '');
  return parts.map((part, i) => {
    const key = `${keyBase}-${i}`;
    let m;
    if ((m = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/))) {
      return <img key={key} src={ctx.resolveImage(m[2])} alt={m[1]} loading="lazy" className="doc__img" />;
    }
    if ((m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/))) {
      return (
        <DocLink key={key} href={ctx.resolveLink(m[2])}>
          {inline(m[1], ctx, key)}
        </DocLink>
      );
    }
    if ((m = part.match(/^`([^`]+)`$/))) return <code key={key}>{m[1]}</code>;
    if ((m = part.match(/^\*\*([^*]+)\*\*$/))) return <strong key={key}>{inline(m[1], ctx, key)}</strong>;
    if ((m = part.match(/^_([^_]+)_$/))) return <em key={key}>{m[1]}</em>;
    if ((m = part.match(/^\[\[([^\]]+)\]\]$/))) return <kbd key={key}>{m[1]}</kbd>;
    return <Fragment key={key}>{part}</Fragment>;
  });
}

const CALLOUTS = { tip: ['Tip', 'check-circle'], note: ['Note', 'info'], important: ['Important', 'alert-triangle'], warning: ['Warning', 'alert-triangle'] };

function parseBlocks(body) {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith('```')) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      i++;
      blocks.push({ type: 'code', text: code.join('\n') });
      continue;
    }
    let m;
    if ((m = line.match(/^(#{2,4}) (.+)$/))) {
      blocks.push({ type: 'heading', level: m[1].length, text: m[2] });
      i++;
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }
    if (line.startsWith('>')) {
      const quote = [];
      while (i < lines.length && lines[i].startsWith('>')) quote.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push({ type: 'quote', text: quote.join(' ') });
      continue;
    }
    if (line.trim().startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(lines[i++].trim());
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const [head, , ...rest] = rows;
      blocks.push({ type: 'table', head: cells(head), rows: rest.map(cells) });
      continue;
    }
    if (/^(\s*)([-*]|\d+\.) /.test(line)) {
      const ordered = /^\d+\./.test(line.trim());
      const items = [];
      while (i < lines.length && /^(\s*)([-*]|\d+\.) /.test(lines[i])) {
        const indent = lines[i].match(/^\s*/)[0].length;
        const text = lines[i].replace(/^\s*([-*]|\d+\.) /, '');
        if (indent >= 2 && items.length) items[items.length - 1].children.push(text);
        else items.push({ text, children: [] });
        i++;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,4} |```|>|\||\s*([-*]|\d+\.) |---+$)/.test(lines[i])) para.push(lines[i++].trim());
    blocks.push({ type: 'p', text: para.join(' ') });
  }
  return blocks;
}

function DocMarkdown({ body, resolveImage = (s) => s, resolveLink = (h) => h }) {
  const ctx = { resolveImage, resolveLink };
  return (
    <div className="doc">
      {parseBlocks(body).map((b, i) => {
        const key = `b${i}`;
        switch (b.type) {
          case 'heading': {
            const Tag = `h${b.level}`;
            return (
              <Tag key={key} id={slugify(b.text.replace(/[*_`]/g, ''))}>
                {inline(b.text, ctx, key)}
              </Tag>
            );
          }
          case 'code':
            return (
              <pre key={key}>
                <code>{b.text}</code>
              </pre>
            );
          case 'hr':
            return <hr key={key} />;
          case 'quote': {
            const cm = b.text.match(/^\*\*(Tip|Note|Important|Warning):\*\*\s*(.*)$/i);
            if (cm) {
              const [label, icon] = CALLOUTS[cm[1].toLowerCase()];
              return (
                <aside key={key} className={`doc__callout doc__callout--${cm[1].toLowerCase()}`}>
                  <Icon name={icon} size={18} />
                  <p>
                    <strong>{label}:</strong> {inline(cm[2], ctx, key)}
                  </p>
                </aside>
              );
            }
            return <blockquote key={key}>{inline(b.text, ctx, key)}</blockquote>;
          }
          case 'table':
            return (
              <div key={key} className="doc__table">
                <table>
                  <thead>
                    <tr>
                      {b.head.map((c, j) => (
                        <th key={j} scope="col">
                          {inline(c, ctx, `${key}h${j}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, ri) => (
                      <tr key={ri}>
                        {r.map((c, j) => (
                          <td key={j}>{inline(c, ctx, `${key}r${ri}c${j}`)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'list': {
            const Tag = b.ordered ? 'ol' : 'ul';
            return (
              <Tag key={key} className={b.ordered ? 'doc__steps' : undefined}>
                {b.items.map((it, j) => (
                  <li key={j}>
                    {inline(it.text, ctx, `${key}l${j}`)}
                    {it.children.length ? (
                      <ul>
                        {it.children.map((c, k) => (
                          <li key={k}>{inline(c, ctx, `${key}l${j}c${k}`)}</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </Tag>
            );
          }
          default:
            return <p key={key}>{inline(b.text, ctx, key)}</p>;
        }
      })}
    </div>
  );
}

export default memo(DocMarkdown);
