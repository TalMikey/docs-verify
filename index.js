var _ = require('lodash');
var open = require('open');
var path = require('path');
var { readlineWrapper } = require('./readline-wrapper');
var { openRepo, getStagedFilesPaths, getConfigGetter, getLinkedPathsByDocPath } = require('./git');
var { exitSuccess, exitFail } = require('./process-control');

const getDocsUrl = remoteOriginUrl => remoteOriginUrl.includes('.git')
        ? remoteOriginUrl.replace('.git', '.wiki.git') // azure
        : remoteOriginUrl.concat('.wiki'); // github

const getUserApproval = () =>
    readlineWrapper('Would you like to change the docs? (y/n)', (answer, resolve) => {
        if (answer === 'n') {
            resolve();

            return;
        }

        if (answer === 'y') {
            exitFail();
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
            const docsUrl = getDocsUrl(remoteOriginUrl);
            
            const linkedPathsByDoc = await getLinkedPathsByDocPath(docsUrl, configGetter);
            const touched = getTouchedFilesByDoc(linkedPathsByDoc, stagedFilesPaths); 
    
            if (!_.isEmpty(touched)) {
                console.log(
                    'Pay attention! Some docs files linked to code has changed!\n' +
                    'Above are the docs that contains modifed files:\n' +
                    getTouchedAsString(touched)
                );
    
                await getUserApproval();
                await open(docsUrl);
            }
        }

        exitSuccess();
    } catch(e) {
        console.log(e);
        exitFail();
    }
}

start();