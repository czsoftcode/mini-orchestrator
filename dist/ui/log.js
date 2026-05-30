import pc from 'picocolors';
export const log = {
    info: (msg) => {
        console.log(msg);
    },
    success: (msg) => {
        console.log(`${pc.green('[ok]')} ${msg}`);
    },
    warn: (msg) => {
        console.log(`${pc.yellow('[!]')} ${msg}`);
    },
    error: (msg) => {
        console.error(`${pc.red('[x]')} ${msg}`);
    },
    dim: (msg) => {
        console.log(pc.dim(msg));
    },
    title: (msg) => {
        console.log(`\n${pc.bold(msg)}`);
    },
    hint: (msg) => {
        console.log(pc.dim(`  ${msg}`));
    },
};
