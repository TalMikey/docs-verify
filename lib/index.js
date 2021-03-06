#!/usr/bin/env node

import {isEmpty} from 'lodash';
import open from 'open';
import path from 'path';
import { getUserApproval } from './utils/readline-wrapper';
import { createRepoProvider } from './git/git-wiki';
import { getWikiUrlByPlatfrom  } from './git/wiki-platforms';
import { getTouchedFilesByDoc, getTouchedAsString, logTouched } from './touched';
import { exitSuccess, exitFail } from './utils/process-control';

const start = async authMethod => {
    try {
        const rootDir = path.resolve(process.cwd());
        const { getStagedFilesPaths, getLinkedPathsByDocPath, docsInfo } = await createRepoProvider(rootDir, authMethod);
        const stagedFilesPaths = await getStagedFilesPaths();

        if (stagedFilesPaths.length) {
            const linkedPathsByDoc = await getLinkedPathsByDocPath();
            const touched = getTouchedFilesByDoc(linkedPathsByDoc, stagedFilesPaths); 
    
            if (!isEmpty(touched)) {
                const touchedString = getTouchedAsString(touched);
                
                console.log(
                    'Pay attention! Some docs files linked to code has changed!\n' +
                    'Above are the docs that contains modifed files:\n' +
                    touchedString
                );
    
                const prompt = await getUserApproval('Would you like to change the docs?');
                if (prompt === 'y') {
                    await logTouched(docsInfo, touchedString);
                    await open(getWikiUrlByPlatfrom (docsInfo), { wait: true });

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

start(...process.argv.slice(2));