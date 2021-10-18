var NodeGit = require('nodegit');
var readline = require('readline');
var _ = require('lodash');
var open = require('open');
var path = require('path');
var fs = require('fs/promises');
const { read } = require('fs');

const LINKS_REGEX = /\s?[Ll]inks\s?:\s?\n((- [a-zA-Z0-9\\\/\.]+\n?)+)/g;
const SUCESS_CODE = 0;
const FAIL_CODE = 1;
const CONFIG_FILE = 'docs.config.json';

const reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const readlineWrapper = (question, answerFunc) => new Promise(resolve => { 
    reader.resume();
    reader.question(question, answer => {
        reader.pause();
        reader.stdoutMuted = false;
        answerFunc(answer, resolve);
    });
});

const getWithPassword = input => {
    if (input === '\r\n') {
        return input;
    }

    if (!input.includes(reader._prompt)) {
        return '*'.repeat(input.length);
    }

    // backspace returns the entire line
    return reader._prompt.concat('*'.repeat(input.substring(reader._prompt.length).length));
};

reader._writeToOutput = input => {
    reader.output.write(reader.stdoutMuted ? getWithPassword(input) : input);
}

const exit = code => {
    reader.close();
    process.exit(code);
}

const openRepo = path => NodeGit.Repository.open(path);

const getConfigGetter = async repo => {
    const config = await repo.config();

    return value => config.getStringBuf(value);
}  

// TODO: add ssh option
const getFetchOptions = async (configGetter, gitToken) => {
    const userName = await configGetter('user.name');

    return {
        callbacks: {
            credentials: (_url, _userName) => NodeGit.Cred.userpassPlaintextNew(userName, gitToken),
            certificateCheck: () => 0
        }
    }
}

const getDocsUrl = remoteOriginUrl => remoteOriginUrl.includes('.git')
        ? remoteOriginUrl.replace('.git', '.wiki.git') // azure
        : remoteOriginUrl.concat('.wiki'); // github

const getDocsPath = docsUrl => path.join(
    __dirname, 
    _.last(docsUrl.split('/')).replace('.git', '')
);

const getStagedFilesPaths = async repo => {
    const head = await repo.getHeadCommit();
    const diff = await NodeGit.Diff.treeToIndex(repo, await head.getTree());
    const filesChanged = await diff.patches();
    
    return filesChanged.map(x => x.newFile().path());
}

const getLinksFromFile = content => {
    const linksMatches = [...Array.from(content.matchAll(LINKS_REGEX))];

    const linksSections = linksMatches.map(match =>
        match[1]
        .split('\n')
        .filter(x => !!x)
        .map(x => x.substring(2))
    );

    return _.flatten(linksSections);
}

const pull = async (docsPath, fetchOpts) => {
    const repo = await openRepo(docsPath);

    await repo.fetchAll(fetchOpts);

    const masterBranch = await repo.getCurrentBranch();
    const masterBranchName = masterBranch.shorthand();
    await repo.mergeBranches(masterBranchName, `origin/${masterBranchName}`);

    return repo;
}

const getGitToken = async docsPath => {
    try {
        const configFile = await fs.readFile(path.join(docsPath, CONFIG_FILE));
        const config = JSON.parse(configFile);

        return config.gitToken;
    }
    catch (err) {
        if (err.code === 'ENOENT') {
            reader.stdoutMuted = true;
            
            return await readlineWrapper('please enter git token: ', (answer, resolve) => resolve(answer));
        }

        throw err;
    }
}

const addConfig = async (docsPath, gitToken) => {
    await fs.writeFile(path.join(docsPath, CONFIG_FILE), JSON.stringify({gitToken}));
    await fs.appendFile('.gitignore', `\r\n${_.last(docsPath.split('\\'))}/`);
}

const getDocsRepo = async (remoteOriginUrl, configGetter) => {
    let docsRepo = {};

    const docsUrl = getDocsUrl(remoteOriginUrl);
    const docsPath = getDocsPath(docsUrl);
    const gitToken = await getGitToken(docsPath);
    const fetchOpts = await getFetchOptions(configGetter, gitToken);
    
    try {
        docsRepo = await NodeGit.Clone.clone(docsUrl, docsPath, {fetchOpts});
        await addConfig(docsPath, gitToken);
        console.log(`Cloned docs files to ${docsPath}`);
    }
    catch(err)
    {
        if (err.errno !== NodeGit.Error.CODE.EEXISTS){
            throw err;
        }
        
        docsRepo = await pull(docsPath, fetchOpts);
        console.log('Finished fetch docs files');
    }

    if (_.isNil(docsRepo)) {
        throw 'Couldn\'t find repository'; 
    }

    return docsRepo;
} 

const getLinkedPathsByDocPath = async (remoteOriginUrl, configGetter) => {
    try {
        const docsRepo = await getDocsRepo(remoteOriginUrl, configGetter);
        const head = await docsRepo.getHeadCommit();
        const headTree = await head.getTree();
    
        // TODO: add change type and if the files name changed
        const linksByPath = await Promise.all(headTree.entries().filter(x => x.isBlob()).map(async x => ({
            path: x.path(),
            links: getLinksFromFile((await x.getBlob()).content().toString())
        })));
    
        return linksByPath.filter(x => x.links.length);
    }
    catch(err) {
        if (err.errno === NodeGit.Error.CODE.ERROR) {
            console.log('Docs (wiki) does not exists for current repository or token is invalid');

            exit(FAIL_CODE);
        }

        throw err;
    }
}

const getUserApproval = () =>
    readlineWrapper('Would you like to change the docs? (y/n)', (answer, resolve) => {
        if (answer === 'n') {
            resolve();

            return;
        }

        if (answer === 'y') {
            exit(FAIL_CODE);
        }

        return getUserApproval();
    });

const getTouchedFilesByDoc = (linkedPathsByDoc, stagedFilesPaths) => 
    linkedPathsByDoc.reduce((acc, value) => {
        const {path, links} = value;

        const touchedFilesPaths = links.filter(linkPath => stagedFilesPaths.includes(linkPath));
        
        if (touchedFilesPaths.length) {
            acc[path] = touchedFilesPaths;
        }

        return acc;
    }, {});

const getTouchedAsString = touched => 
    Object.entries(touched).reduce((acc, value) => {
        const [path, links] = value;
        const description = `${path}: \n`.concat(links.map(link => `\t- ${link}`).join('\n'))

        return acc.concat(description);
    }, '');

const start = async () => {
    try {
        const repo = await openRepo(__dirname);
        const stagedFilesPaths = await getStagedFilesPaths(repo);

        if (stagedFilesPaths.length) {
            const configGetter = await getConfigGetter(repo);
            const remoteOriginUrl = await configGetter('remote.origin.url');
            const linkedPathsByDoc = await getLinkedPathsByDocPath(remoteOriginUrl, configGetter);
            const touched = getTouchedFilesByDoc(linkedPathsByDoc, stagedFilesPaths); 
    
            if (!_.isEmpty(touched)) {
                console.log(
                    'Pay attention! Some docs files linked to code has changed!\n' +
                    'Above are the docs that contains modifed files:\n' +
                    getTouchedAsString(touched)
                );
    
                await getUserApproval();
                await open(getDocsUrl(remoteOriginUrl));
            }
        }

        exit(SUCESS_CODE);
    } catch(e) {
        console.log(e);
        exit(FAIL_CODE);
    }
}

start();