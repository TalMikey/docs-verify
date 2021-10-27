import { closeReader } from './readline-wrapper';

const SUCESS_CODE = 0;
const FAIL_CODE = 1;

const exit = code => {
    closeReader();
    process.exit(code);
}

const exitSuccess = () => exit(SUCESS_CODE);
const exitFail = () => exit(FAIL_CODE);

export {
    exitSuccess,
    exitFail
}