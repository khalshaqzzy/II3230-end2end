import { parseArgs } from 'node:util';

import {
  loadScriptEnv,
  printJson,
  resolveTargetBaseUrl,
  writeJsonOutput,
} from './support/cli';
import { fetchJson } from './support/http';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    target: {
      type: 'string',
    },
    output: {
      type: 'string',
    },
  },
});

const messageId = positionals[0];

if (!messageId) {
  throw new Error('messageId is required as the first positional argument.');
}

const env = loadScriptEnv();
const targetBaseUrl = resolveTargetBaseUrl(values.target, env);
const detail = await fetchJson({
  url: `${targetBaseUrl}/messages/${messageId}`,
});

writeJsonOutput(values.output, detail);
printJson(detail);
