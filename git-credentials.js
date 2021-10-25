const { spawnAsync } = require('./spawn-async');
const { exitFail } = require('./process-control');

const CREDENTIAL_REGEX = /username=([^\n]+)\npassword=([^\n]+)\n/;

const options = {
	encoding: 'utf8',
	env: {GIT_TERMINAL_PROMPT: '0', ...process.env}
};

const getCredentialPrompt = url => {
	const { protocol, host } = new URL(url);

	return [`protocol=${protocol.replace(':','')}`, `host=${host}`];
};

const getOptions = () => ({
	encoding: 'utf8',
	env: {GIT_TERMINAL_PROMPT: '0', ...process.env}
});

const parse = result => {
	const match = result.match(CREDENTIAL_REGEX);
	
    if (!match) {
		return null;
	}

	const [ , , password] = match;

	return password;
}

const getCredentials = async url => {
    try {
		const credentialMethod = (await spawnAsync('git', ['config', '--get', 'credential.helper'])).replace('\n', '');
		const credentials = await spawnAsync(
			'git', 
			[`credential-${credentialMethod}`, 'get'], 
			getOptions(), 
			getCredentialPrompt(url)
		);
		
		return parse(credentials);
    } catch(err) {
		const message = err 
			? `An error occured: ${err}.\nPlease check U have Git PAT.`
			: 'Couldn\'t find Git PAT. Please fill with git credential.helper command';

		console.log(message);
		exitFail();
    }
}

module.exports = { getCredentials };