import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cleanMarkdownText(input: string) {
  return input
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/[#>*`_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitIntoSentences(input: string) {
  const normalized = cleanMarkdownText(input);
  if (!normalized) {
    return [];
  }

  const matches = normalized.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [];
  return matches
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function summarizeToSentenceCount(input: string, count = 3) {
  const sentences = splitIntoSentences(input);
  if (sentences.length) {
    return sentences.slice(0, count).join(' ');
  }

  return cleanMarkdownText(input).slice(0, 160);
}
