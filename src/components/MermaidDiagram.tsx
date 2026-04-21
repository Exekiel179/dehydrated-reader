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

function buildFallbackChart(chart: string) {
  const labels = Array.from(chart.matchAll(/\["([^"]+)"\]|\[([^\]]+)\]|\(([^\)]+)\)|\{([^}]+)\}/g))
    .map((match) => cleanNodeLabel(match[1] || match[2] || match[3] || match[4] || ''))
    .filter(Boolean)
    .filter((label, index, labels) => labels.indexOf(label) === index)
    .slice(0, 6);

  const safeLabels = labels.length >= 2 ? labels : ['结构起点', '关键论点', '证据支撑', '结论收束'];
  const lines = ['flowchart TD'];
  safeLabels.forEach((label, index) => {
    lines.push(`N${index + 1}["${label}"]`);
  });
  safeLabels.slice(1).forEach((_label, index) => {
    lines.push(`N${index + 1} --> N${index + 2}`);
  });
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
          suppressErrorRendering: true,
        });

        const renderAttempt = async (diagramId: string, source: string) => {
          await mermaid.parse(source, { suppressErrors: false });
          const result = await mermaid.render(diagramId, source);
          if (/Syntax error in text|mermaid version/i.test(result.svg)) {
            throw new Error('Mermaid returned an error diagram.');
          }
          return result.svg;
        };

        const candidates = [chart, repairMermaidChart(chart), buildFallbackChart(chart)];
        let rendered = '';
        let lastError: unknown = null;

        for (const [index, candidate] of candidates.entries()) {
          try {
            rendered = await renderAttempt(`diagram-${id}-${index}`, candidate);
            break;
          } catch (error) {
            lastError = error;
          }
        }

        if (!rendered) {
          throw lastError instanceof Error ? lastError : new Error('结构图解析失败');
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
