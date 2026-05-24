import pc from 'picocolors';

export const log = {
  info: (msg: string): void => {
    console.log(msg);
  },
  success: (msg: string): void => {
    console.log(`${pc.green('[ok]')} ${msg}`);
  },
  warn: (msg: string): void => {
    console.log(`${pc.yellow('[!]')} ${msg}`);
  },
  error: (msg: string): void => {
    console.error(`${pc.red('[x]')} ${msg}`);
  },
  dim: (msg: string): void => {
    console.log(pc.dim(msg));
  },
  title: (msg: string): void => {
    console.log(`\n${pc.bold(msg)}`);
  },
  hint: (msg: string): void => {
    console.log(pc.dim(`  ${msg}`));
  },
};
