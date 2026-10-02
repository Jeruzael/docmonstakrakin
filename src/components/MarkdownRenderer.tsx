import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExternalLink } from 'lucide-react';

export interface MarkdownRendererProps {
  content: string;
  className?: string;
  testId?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
  testId,
}) => {
  const components = useMemo(
    () => ({
      h1: ({ node, ...props }: any) => (
        <h1
          className="text-3xl font-bold tracking-tight text-slate-950 mb-6 pb-2 border-b border-slate-200"
          {...props}
        />
      ),
      h2: ({ node, ...props }: any) => (
        <h2
          className="text-xl font-semibold text-slate-900 mt-10 mb-4 pb-1 border-b border-slate-100"
          {...props}
        />
      ),
      h3: ({ node, ...props }: any) => (
        <h3
          className="text-lg font-semibold text-slate-900 mt-8 mb-3"
          {...props}
        />
      ),
      h4: ({ node, ...props }: any) => (
        <h4
          className="text-base font-semibold text-slate-900 mt-6 mb-2"
          {...props}
        />
      ),
      p: ({ node, ...props }: any) => (
        <p className="text-[15px] text-slate-700 leading-7 mb-4" {...props} />
      ),
      strong: ({ node, ...props }: any) => (
        <strong className="font-semibold text-slate-950" {...props} />
      ),
      ul: ({ node, ...props }: any) => (
        <ul
          className="list-disc pl-6 space-y-1.5 my-4 text-slate-700"
          {...props}
        />
      ),
      ol: ({ node, ...props }: any) => (
        <ol
          className="list-decimal pl-6 space-y-1.5 my-4 text-slate-700"
          {...props}
        />
      ),
      li: ({ node, ...props }: any) => (
        <li className="text-slate-700 leading-7" {...props} />
      ),
      hr: ({ node, ...props }: any) => (
        <hr className="border-slate-200 my-8" {...props} />
      ),
      blockquote: ({ node, ...props }: any) => (
        <blockquote
          className="border-l-4 border-emerald-500 bg-emerald-50/50 text-slate-700 px-4 py-3 rounded-r-lg my-4 italic"
          {...props}
        />
      ),
      pre: ({ node, ...props }: any) => (
        <pre
          className="bg-slate-950 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto my-4 leading-relaxed border border-slate-800"
          {...props}
        />
      ),
      code: ({ node, className, children, ...props }: any) => {
        const isBlock =
          Boolean(className) ||
          (typeof children === 'string' && children.includes('\n'));
        if (isBlock) {
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        }
        return (
          <code
            className="font-mono text-[13px] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200"
            {...props}
          >
            {children}
          </code>
        );
      },
      table: ({ node, ...props }: any) => (
        <div className="my-6 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-left text-sm" {...props} />
        </div>
      ),
      thead: ({ node, ...props }: any) => (
        <thead
          className="bg-slate-50 border-b border-slate-200 text-slate-900 font-semibold"
          {...props}
        />
      ),
      th: ({ node, ...props }: any) => (
        <th
          className="px-4 py-3 border-r border-slate-200 last:border-r-0 font-semibold text-slate-900"
          {...props}
        />
      ),
      td: ({ node, ...props }: any) => (
        <td
          className="px-4 py-2.5 border-t border-r border-slate-200 last:border-r-0 text-slate-700"
          {...props}
        />
      ),
      tr: ({ node, ...props }: any) => (
        <tr className="hover:bg-slate-50/50 transition-colors" {...props} />
      ),
      a: ({ node, href, children, ...props }: any) => {
        if (!href) {
          return (
            <a className="text-slate-400 underline cursor-not-allowed" {...props}>
              {children}
            </a>
          );
        }
        const normalized = href.trim().toLowerCase();
        if (
          normalized.startsWith('javascript:') ||
          normalized.startsWith('data:') ||
          normalized.startsWith('vbscript:')
        ) {
          return (
            <a className="text-slate-400 underline cursor-not-allowed" {...props}>
              {children}
            </a>
          );
        }

        const isExternal =
          normalized.startsWith('http://') || normalized.startsWith('https://');
        if (isExternal) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:text-emerald-700 underline font-medium inline-flex items-center gap-1"
              {...props}
            >
              {children}
              <ExternalLink className="w-3 h-3 inline-block" />
            </a>
          );
        }

        return (
          <a
            href={href}
            className="text-emerald-600 hover:text-emerald-700 underline font-medium"
            {...props}
          >
            {children}
          </a>
        );
      },
    }),
    []
  );

  return (
    <div className={`markdown-body ${className}`} data-testid={testId}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
};
