import { useEffect, useId, useState } from 'react';

interface MermaidDiagramProps {
  chart: string;
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const id = useId().replace(/:/g, '-');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: 'neutral',
        });
        const { svg: rendered } = await mermaid.render(`diagram-${id}`, chart);
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setSvg('');
          setError('结构图解析失败');
        }
      }
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return (
      <div className="flex h-full min-h-64 items-center justify-center rounded-lg border border-outline-variant/16 bg-surface-container-lowest text-sm text-on-surface-variant">
        {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="flex h-full min-h-64 items-center justify-center rounded-lg border border-outline-variant/16 bg-surface-container-lowest text-sm text-on-surface-variant">
        正在生成结构图…
      </div>
    );
  }

  return (
    <div
      className="mermaid-diagram min-h-64 overflow-auto rounded-lg border border-outline-variant/12 bg-surface-container-lowest p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
