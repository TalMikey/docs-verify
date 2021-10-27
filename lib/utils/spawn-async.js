import { spawn } from 'child_process';

const spawnAsync = (file, args, options, prompt) => new Promise((resolve, reject) => {
    const child = spawn(file, args, options);

    if (prompt) {
        prompt.forEach(x => {
            child.stdin.write(`${x}\n`);
        });
    }

    child.stdin.end();

    child.stdout.on('data', data => {
        resolve(data.toString());
    });

    child.stdout.on('error', data => {
        reject(data.toString());
    });

    child.on('exit', err => {
        reject();
    });
});

export { spawnAsync };