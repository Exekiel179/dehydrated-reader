import { useEffect, useId, useState } from 'react';

interface MermaidDiagramProps {
  chart: string;
}

function cleanNodeLabel(label: string) {
  return label
    .replace(/\\[nr]/g, ' ')
    .replace(/[`"'<>[\]{}()（）|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 34) || '节点';
}

function repairMermaidChart(chart: string) {
  const fenced = chart.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || chart)
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!candidate.length) {
    return chart;
  }

  const lines = candidate.map((line, index) => {
    if (index === 0) {
      return line.replace(/^graph\b/i, 'flowchart').replace(/\b(LR|RL|BT)\b/i, 'TD');
    }

    return line
      .replace(/\b([A-Za-z][\w-]*)\s*\[\s*"?([^\]"]+)"?\s*\]/g, (_match, id: string, label: string) => {
        return `${id}["${cleanNodeLabel(label)}"]`;
      })
      .replace(/\b([A-Za-z][\w-]*)\s*\(\s*"?([^()"]+)"?\s*\)/g, (_match, id: string, label: string) => {
        return `${id}["${cleanNodeLabel(label)}"]`;
      })
      .replace(/\b([A-Za-z][\w-]*)\s*\{\s*"?([^{}"]+)"?\s*\}/g, (_match, id: string, label: string) => {
        return `${id}["${cleanNodeLabel(label)}"]`;
      });
  });

  if (!lines[0].startsWith('flowchart') && !lines[0].startsWith('graph')) {
    lines.unshift('flowchart TD');
  }

  return lines.join('\n');
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
        let rendered = '';
        try {
          const result = await mermaid.render(`diagram-${id}`, chart);
          rendered = result.svg;
        } catch {
          const result = await mermaid.render(`diagram-${id}-repaired`, repairMermaidChart(chart));
          rendered = result.svg;
        }
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
