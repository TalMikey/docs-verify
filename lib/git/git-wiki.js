const NodeGit = require('nodegit');
const _ = require('lodash');
const axios = require('axios');
const path = require('path');
const { appendFile } = require('fs/promises');
const { exitFail } = require('../utils/process-control');
const { getCredentials } = require('./git-credentials');
const { getDocsUrl } = require('./wiki-platforms');

const LINKS_REGEX = /\s?[Ll]inks\s?:\s?\n(([-*] [a-zA-Z0-9\\\/\.]+\n?)+)/g;

const openRepo = path => NodeGit.Repository.open(path);

const createConfigGetter = async repo => {
    const config = await repo.config();

    return value => config.getStringBuf(value);
}

const getDocsPath = (gitPath, docsUrl) => path.join(
    gitPath,
    _.last(docsUrl.split('/')).replace('.git', '')
);

const getDocsInfo = (gitPath, remoteOriginUrl) => {
    const url = getDocsUrl(remoteOriginUrl);
    const path = getDocsPath(gitPath, url);
    
    return { url, path };
}

const authMethodsToCredentialProvider = {
    https: (userName, gitToken) => NodeGit.Cred.userpassPlaintextNew(userName, gitToken), 
    ssh: (username) => NodeGit.Cred.sshKeyFromAgent(userName)
};

const getFetchOptions = async (configGetter, gitToken, authMethod) => {
    const userName = await configGetter('user.name');
    const credentialsProvider = authMethodsToCredentialProvider[authMethod] || authMethod.https;

    return {
        callbacks: {
            credentials: (_url, _userName) => credentialsProvider(userName, gitToken),
            certificateCheck: () => 0
        }
    }
}

const isPrivateRepo = async path => {
    try {
        const {status} = await axios.get(`${path}/info/refs?service=git-upload-pack`);

        return status === 401;
    } catch (err){
        return err.response.status === 401;
    }
}

const addConfig = async docsPath => {
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
        await addConfig(docsPath);
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

const getDocsRepo = async (docsInfo, configGetter, authMethod) => {
    let fetchOpts = {};
    const { url: docsUrl, path: docsPath } = docsInfo;

    if (await isPrivateRepo(docsUrl)) {
        const gitToken = await getCredentials(docsUrl);
        fetchOpts = await getFetchOptions(configGetter, gitToken, authMethod);
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

const getLinkedPathsByDocPath = async (docsInfo, configGetter, authMethod) => {
    const docsRepo = await getDocsRepo(docsInfo, configGetter, authMethod);
    const head = await docsRepo.getHeadCommit();
    const headTree = await head.getTree();

    const linksByPath = await Promise.all(headTree.entries().filter(x => x.isBlob()).map(async x => ({
        path: x.path(),
        links: getLinksFromFile((await x.getBlob()).content().toString())
    })));

    return linksByPath.filter(x => x.links.length);
}

const getStagedFilesPaths = async repo => {
    const head = await repo.getHeadCommit();
    const diff = await NodeGit.Diff.treeToIndex(repo, await head.getTree());
    const filesChanged = await diff.patches();
    
    return filesChanged.map(x => x.newFile().path());
}

const createRepoProvider = async (path, authMethod) => {
    const repo = await openRepo(path);
    const configGetter = await createConfigGetter(repo);
    const remoteOriginUrl = await configGetter('remote.origin.url');
    const docsInfo = getDocsInfo(path, remoteOriginUrl);

    return {
        getStagedFilesPaths: () => getStagedFilesPaths(repo),
        getLinkedPathsByDocPath: () => getLinkedPathsByDocPath(docsInfo, configGetter, authMethod),
        docsInfo
    }
}

module.exports = { createRepoProvider };