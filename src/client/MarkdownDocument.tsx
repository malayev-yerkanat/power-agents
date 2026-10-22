import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const plugins = [remarkGfm];

function documentUrl(value: string): string {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password
      ? url.href
      : '';
  } catch {
    return '';
  }
}

export function MarkdownDocument({ body }: { body: string }) {
  return <div className="markdown-document">
    <Markdown remarkPlugins={plugins} skipHtml urlTransform={documentUrl} components={{
      h1: ({ children }) => <h3>{children}</h3>,
      h2: ({ children }) => <h4>{children}</h4>,
      h3: ({ children }) => <h5>{children}</h5>,
      h4: ({ children }) => <h6>{children}</h6>,
      h5: ({ children }) => <h6>{children}</h6>,
      h6: ({ children }) => <h6>{children}</h6>,
      img: ({ alt }) => <span className="document-image-note">[Изображение: {alt || 'без подписи'}]</span>,
      a: ({ href, children }) => href
        ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
        : <span>{children}</span>,
      table: ({ children }) => <div className="document-table" tabIndex={0} role="region" aria-label="Таблица документа"><table>{children}</table></div>,
    }}>{body}</Markdown>
  </div>;
}
