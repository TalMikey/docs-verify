var NodeGit = require('nodegit');

const LINKS_REGEX = /\s?[Ll]inks\s?:\s?\n((- [a-zA-Z0-9\\\/\.]+\n?)+)/g;

const openRepo = async path => await NodeGit.Repository.open(path);

const getStagedFilesPaths = async repoPath => {
    const repo = await openRepo(repoPath);  
    const head = await repo.getHeadCommit();
    const diff = await NodeGit.Diff.treeToIndex(repo, await head.getTree());
    const filesChanged = await diff.patches();
    
    return filesChanged.map(x => x.newFile().path());
};

const getLinksFromFile = content => {
    const linksMatches = [...Array.from(content.matchAll(LINKS_REGEX))];

    const linksSections = linksMatches.map(match =>
        match[1]
        .split('\n')
        .filter(x => !!x)
        .map(x => x.substring(2))
    );

    return [].concat(...linksSections);
};

const getLinkedPathsByDocPath = async docsRepoPath => {
    // TODO: docs head in git is not updated after change in azure 
    const repo = await openRepo(docsRepoPath);
    const head = await repo.getHeadCommit();
    const headTree = await head.getTree();

    const linksByPath = await Promise.all(headTree.entries().filter(x => x.isBlob()).map(async x => ({
        path: x.path(),
        links: getLinksFromFile((await x.getBlob()).content().toString())
    })));

    return linksByPath.filter(x => x.links.length);
};

const getTouchedFilesByDoc = async (repoPath, docsRepoPath) => {
    try {
        const stagedFilesPaths = await getStagedFilesPaths(repoPath);
        const linkedPathsByDoc = await getLinkedPathsByDocPath(docsRepoPath);

        const touched = linkedPathsByDoc.reduce((acc, value) => {
            const {path, links} = value; 

            const touchedFilesPaths = links.filter(linkPath => stagedFilesPaths.includes(linkPath));
            acc[path] = touchedFilesPaths;

            return acc;
        }, {});
    } catch(e) {
        console.log(e);
    }
};

getTouchedFilesByDoc("C:\\Users\\talmi\\Desktop\\projects\\docs-verify", "C:\\Users\\talmi\\Desktop\\projects\\makmarschool.wiki");