const getDocsUrl = remoteOriginUrl => remoteOriginUrl.includes('.git')
        ? remoteOriginUrl.replace('.git', '.wiki.git') // github
        : remoteOriginUrl.concat('.wiki'); // azure
        
const getWikiUrlByPlatfrom = wikiCloneUrl => {
    const platforms = {
        'azure': wikiCloneUrl.replace('_git', '_wiki/wikis'),
        'github': wikiCloneUrl.replace('.wiki.git', '/wiki')
    };

    const platform = Object.keys(platforms).find(key => wikiCloneUrl.includes(key));

    return platforms[platform];
}

module.exports = {
    getDocsUrl, 
    getWikiUrlByPlatfrom
}