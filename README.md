# docs-verify
Make code documentation meaningful!
 
Link between your code and its documentation(wiki) and verify that wiki files remain up-to-date with `pre-commit` hook for git.

## Motivation
In large code-bases, documentation is often required for some of the main logic modules in our app.  

Some write docs in .txt/.docx/etc files, some use wiki, and some doesn't write documentation at all.

To write docs is one thing, but maintain them up-to-date is another. When code is changed, it's often comfortable to "forget" to update the docs. This cause our docs to be outdated and irrelevant.

In order to solve this problem, `docs-verify` was created.

## Culture
Docs **shouldn't** be created for every file. It was meant to explain specific logic in our app that is hard to understand at first glance or at one debuging session. It's meant for infrastructure code mechanism or important flows in our app only.
 
To use this hook as it should be used, you need to write all your documentation files in wiki section.
If you have un-organized docs somewhere, please move them to wiki.
Please read about wiki at [About wikis](https://docs.github.com/en/communities/documenting-your-project-with-wikis/about-wikis)

## Install
```
npx docs-verify-init && npm install       # npm
npx docs-verify-init && yarn              # Yarn 1
yarn dlx docs-verify-init --yarn2 && yarn # Yarn 2
```
[docs-verify-init](https://www.npmjs.com/package/docs-verify-init)

To change `husky` configuration refer to [husky](https://typicode.github.io/husky/#/?id=custom-directory) 

## Uninstall
### npm
`npm uninstall husky docs-verify && git config --unset core.hooksPath`
### Yarn 2
Remove `"postinstall": "husky install"` and `"docs-verify": "docs-verify"` from package.json and run:

`yarn remove husky && git config --unset core.hooksPath`

## Usage
The default clone method is `https`. To use ssh, add `ssh` to `docs-verify` script in your `package.json`.

In order to use the hook, you need to create a wiki file and link code path to it. The convention for this is:
```
L/links:
*/- path
*/- path
```

## How it works
In order to read wiki files, `docs-verify` clone wiki repo as sub repository([Submodules](http://git-scm.com/book/en/v2/Git-Tools-Submodules)) in the first use and adds it to `.gitignore`. When committing, The repo will be pulled to check for changes.

`docs-verify` finds all `L/links:` sections and check your staged files paths against the wiki links. If staged files paths were found in any of the docs links, you will be notified and asked to update the docs. If you do, you will be navigated to the wiki page and a `[your_repository_name.wiki]/touched.log` file will be written with the touched files description as displayed before the prompt.