var readline = require('readline');

const reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const readlineWrapper = (question, answerFunc) => new Promise(resolve => { 
    reader.resume();
    reader.question(question, answer => {
        reader.pause();
        answerFunc(answer, resolve);
    });
});

const getUserApproval = question =>
    readlineWrapper(`${question} (y/n)`, (answer, resolve) => {
        if (answer === 'n' || answer === 'y') {
            resolve(answer);

            return;
        }

        return getUserApproval(question);
    });

module.exports = {
    readlineWrapper,
    getUserApproval,
    closeReader: () => reader.close()
}