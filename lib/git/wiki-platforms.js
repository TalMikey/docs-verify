const getDocsUrl = remoteOriginUrl => remoteOriginUrl.includes('.git')
        ? remoteOriginUrl.replace('.git', '.wiki.git') // github
        : remoteOriginUrl.concat('.wiki'); // azure
        
const getWikiUrlByPlatfrom = ({url}) => {
    const platforms = {
        'azure': url.replace('_git', '_wiki/wikis'),
        'github': url.replace('.wiki.git', '/wiki')
    };

    const platform = Object.keys(platforms).find(key => url.includes(key));

    return platforms[platform];
}

export {
    getDocsUrl, 
    getWikiUrlByPlatfrom
}