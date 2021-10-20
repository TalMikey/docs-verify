var _ = require('lodash');
var open = require('open');
var path = require('path');
var { writeFile } = require('fs/promises');
var { readlineWrapper } = require('./readline-wrapper');
var { openRepo, getStagedFilesPaths, getConfigGetter, getLinkedPathsByDocPath } = require('./git');
var { exitSuccess, exitFail } = require('./process-control');
var { getDocsUrl, getWikiUrlByPlatfrom } = require('./wiki-platforms');

const getDocsPath = docsUrl => path.join(
    __dirname, 
    _.last(docsUrl.split('/')).replace('.git', '')
);

const getDocsInfo = remoteOriginUrl => {
    const url = getDocsUrl(remoteOriginUrl);
    const path = getDocsPath(url);
    
    return { url, path };
}

const getUserApproval = () =>
    readlineWrapper('Would you like to change the docs? (y/n)', (answer, resolve) => {
        if (answer === 'n' || answer === 'y') {
            resolve(answer);

            return;
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
            const docsInfo = getDocsInfo(remoteOriginUrl);
            
            const linkedPathsByDoc = await getLinkedPathsByDocPath(docsInfo, configGetter);
            const touched = getTouchedFilesByDoc(linkedPathsByDoc, stagedFilesPaths); 
    
            if (!_.isEmpty(touched)) {
                const touchedString = getTouchedAsString(touched)
                
                console.log(
                    'Pay attention! Some docs files linked to code has changed!\n' +
                    'Above are the docs that contains modifed files:\n' +
                    touchedString
                );
    
                const prompt = await getUserApproval();
                if (prompt === 'y') {
                    const touchedFileLocation = path.join(docsInfo.path, 'touched.txt');
                    await writeFile(touchedFileLocation, touchedString);
                    console.log(`Touched docs file log written to: ${touchedFileLocation}`);

                    await open(getWikiUrlByPlatfrom(docsInfo.url), { wait: true });

                    exitFail();
                }
            }
        }

        exitSuccess();
    } catch(e) {
        console.log(e);
        exitFail();
    }
}

start();