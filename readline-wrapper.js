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

module.exports = {
    readlineWrapper,
    closeReader: () => reader.close()
}