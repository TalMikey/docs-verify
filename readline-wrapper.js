const { read } = require('fs');
var readline = require('readline');

const reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const getWithPassword = input => {
    if (!input.includes(reader._prompt)) {
        return '*'.repeat(input.length);
    }

    // backspace returns the entire line
    return reader._prompt.concat('*'.repeat(input.substring(reader._prompt.length).length));
};

reader._writeToOutput = input => {
    reader.output.write(reader.stdoutMuted && input !== '\r\n' ? getWithPassword(input) : input);
}

const readlineWrapper = (question, answerFunc) => new Promise(resolve => { 
    reader.resume();
    reader.question(question, answer => {
        reader.pause();
        reader.stdoutMuted = false;
        answerFunc(answer, resolve);
    });
});

module.exports = {
    readlineWrapper,
    closeReader: () => reader.close()
}