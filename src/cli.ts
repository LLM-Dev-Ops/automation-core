#!/usr/bin/env node
// LLM-Automation-Core CLI
// Provides command-line interface for automation execution

import { createAutomationCore } from './lib.js';

const COMMANDS = {
  execute: 'Execute an automation request',
  help: 'Show this help message',
} as const;

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'execute':
      await executeCommand(args);
      break;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      showHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

async function executeCommand(args: string[]): Promise<void> {
  const pipelineId = getArg(args, '--pipeline', '-p');
  const inputJson = getArg(args, '--input', '-i') ?? '{}';
  const provider = getArg(args, '--provider');
  const tier = getArg(args, '--tier') as 'fast' | 'balanced' | 'quality' | undefined;

  let input: Record<string, unknown>;
  try {
    input = JSON.parse(inputJson);
  } catch {
    console.error('Invalid JSON input');
    process.exit(1);
  }

  const core = createAutomationCore();
  const result = await core.execute({
    pipelineId,
    input,
    routingHints: { preferredProvider: provider, modelTier: tier },
  });

  console.log(JSON.stringify(result, null, 2));
}

function getArg(args: string[], long: string, short?: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === long || (short && args[i] === short)) {
      return args[i + 1];
    }
    if (args[i].startsWith(`${long}=`)) {
      return args[i].slice(long.length + 1);
    }
  }
  return undefined;
}

function showHelp(): void {
  console.log(`
LLM-Automation-Core CLI

Usage: llm-automation <command> [options]

Commands:
${Object.entries(COMMANDS).map(([cmd, desc]) => `  ${cmd.padEnd(12)} ${desc}`).join('\n')}

Execute Options:
  --pipeline, -p <id>    Pipeline ID to execute
  --input, -i <json>     Input data as JSON string
  --provider <id>        Preferred provider ID
  --tier <tier>          Model tier: fast, balanced, quality

Examples:
  llm-automation execute --pipeline my-pipeline --input '{"prompt":"Hello"}'
  llm-automation execute -p default -i '{}' --tier fast
`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
