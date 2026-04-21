import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { env, pipeline } from '@huggingface/transformers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(PROJECT_ROOT, '.runtime', 'hf-cache');

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const EMBEDDING_DTYPE = process.env.EMBEDDING_DTYPE || 'q8';
const RERANKER_MODEL = process.env.RERANKER_MODEL || 'Xenova/bge-reranker-base';
const RERANKER_DTYPE = process.env.RERANKER_DTYPE || 'q8';

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  env.cacheDir = CACHE_DIR;

  console.log(`Prewarming embedding model: ${EMBEDDING_MODEL}`);
  await pipeline('feature-extraction', EMBEDDING_MODEL, {
    dtype: EMBEDDING_DTYPE as 'q8' | 'q4' | 'fp32' | 'fp16',
  });

  console.log(`Prewarming reranker model: ${RERANKER_MODEL}`);
  await pipeline('text-classification', RERANKER_MODEL, {
    dtype: RERANKER_DTYPE as 'q8' | 'q4' | 'fp32' | 'fp16',
  });

  console.log('Model cache is ready.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
