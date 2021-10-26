const { writeFile } = require('fs/promises');
const path = require('path');

const getTouchedFilesByDoc = (linkedPathsByDoc, stagedFilesPaths) => 
    linkedPathsByDoc.reduce((acc, value) => {
        const { path, links } = value;

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

const logTouched = async ({path: touchedPath}, touchedString) => {
    const touchedFileLocation = path.join(touchedPath, 'touched.txt');
    await writeFile(touchedFileLocation, touchedString);
    console.log(`Touched docs file log written to: ${touchedFileLocation}`);
}

module.exports = { 
    getTouchedFilesByDoc,
    getTouchedAsString,
    logTouched
};