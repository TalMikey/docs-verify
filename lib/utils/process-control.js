var { closeReader } = require('./readline-wrapper');

const SUCESS_CODE = 0;
const FAIL_CODE = 1;

const exit = code => {
    closeReader();
    process.exit(code);
}

module.exports = {
    exitSuccess: () => exit(SUCESS_CODE),
    exitFail: () => exit(FAIL_CODE)
}