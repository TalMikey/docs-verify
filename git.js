var NodeGit = require('nodegit');
var _ = require('lodash');
var path = require('path');
var axios = require('axios');
var { readFile, writeFile, appendFile } = require('fs/promises');
var { exitFail } = require('./process-control');

const LINKS_REGEX = /\s?[Ll]inks\s?:\s?\n((- [a-zA-Z0-9\\\/\.]+\n?)+)/g;
const CONFIG_FILE = 'docs.config.json';

const getConfigGetter = async repo => {
    const config = await repo.config();

    return value => config.getStringBuf(value);
}

const getFetchOptions = async (configGetter, gitToken, isHttp) => {
    const userName = await configGetter('user.name');

    return {
        callbacks: {
            credentials: (_url, _userName) => isHttp 
                ? NodeGit.Cred.userpassPlaintextNew(userName, gitToken) 
                : cred.sshKeyFromAgent(userName),
            certificateCheck: () => 0
        }
    }
}

const isPrivateRepo = async path => {
    const {status} = await axios.get(`${path}/info/refs?service=git-upload-pack`);
 
    return status === 401;
}

const getGitToken = async docsPath => {
    try {
        const configFile = await readFile(path.join(docsPath, CONFIG_FILE));
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
    await writeFile(path.join(docsPath, CONFIG_FILE), JSON.stringify({gitToken}));
    await appendFile('.gitignore', `\r\n${_.last(docsPath.split('\\'))}/`);
}

const pull = async (docsPath, fetchOpts) => {
    const repo = await openRepo(docsPath);

    await repo.fetchAll(fetchOpts);

    const masterBranch = await repo.getCurrentBranch();
    const masterBranchName = masterBranch.shorthand();
    await repo.mergeBranches(masterBranchName, `origin/${masterBranchName}`);

    return repo;
}

const cloneOrPull = async (docsUrl, docsPath, fetchOpts) => {
    try {
        const docsRepo = await NodeGit.Clone.clone(docsUrl, docsPath, {fetchOpts});
        // await addConfig(docsPath, gitToken);
        console.log(`Cloned docs files to ${docsPath}`);

        return docsRepo;
    }
    catch(err)
    {
        if (err.errno !== NodeGit.Error.CODE.EEXISTS){
            throw err;
        }
        
        const docsRepo = await pull(docsPath, fetchOpts);
        console.log('Finished fetch docs files');

        return docsRepo;
    }
}

const getDocsRepo = async (docsInfo, configGetter, isHttp) => {
    let fetchOpts = {};
    const { url: docsUrl, path: docsPath } = docsInfo;

    if (await isPrivateRepo(docsUrl)) {
        const gitToken = await getGitToken(docsPath);
        fetchOpts = await getFetchOptions(configGetter, gitToken, isHttp);
    }
    
    try {
        return await cloneOrPull(docsUrl, docsPath, fetchOpts); 
    }
    catch(err) {
        if (err.errno === NodeGit.Error.CODE.ERROR) {
            console.log('Docs (wiki) does not exists for current repository or token is invalid');

            exitFail();
        }

        throw err;
    }
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

const getLinkedPathsByDocPath = async (docsInfo, configGetter, isHttp) => {
    const docsRepo = await getDocsRepo(docsInfo, configGetter, isHttp);
    const head = await docsRepo.getHeadCommit();
    const headTree = await head.getTree();

    // TODO: add change type and if the files name changed
    const linksByPath = await Promise.all(headTree.entries().filter(x => x.isBlob()).map(async x => ({
        path: x.path(),
        links: getLinksFromFile((await x.getBlob()).content().toString())
    })));

    return linksByPath.filter(x => x.links.length);
}

const openRepo = path => NodeGit.Repository.open(path);

const getStagedFilesPaths = async repo => {
    const head = await repo.getHeadCommit();
    const diff = await NodeGit.Diff.treeToIndex(repo, await head.getTree());
    const filesChanged = await diff.patches();
    
    return filesChanged.map(x => x.newFile().path());
}

module.exports = {
    openRepo,
    getStagedFilesPaths,
    getConfigGetter,
    getLinkedPathsByDocPath
}