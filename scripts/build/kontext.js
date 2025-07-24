/*
 * Copyright (c) 2015 Charles University, Faculty of Arts,
 *                    Department of Linguistics
 * Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; version 2
 * dated June, 1991.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

/**
 * A bunch of util functions used by KonText build scripts (= Webpack) to inject
 * installation-specific (e.g. custom JS plug-ins) and dynamic (e.g. list of current
 * template JS models) information.
 */
import fs from 'fs';
import { fileURLToPath } from 'url';
import merge from 'merge';
import path from 'path';
import peg from 'peggy';
import { DOMParser } from '@xmldom/xmldom';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function canonizeName(s) {
    return s.replaceAll('_', '-')
}

function camelizeName(s) {
    return s.split('_')
        .map((x, i) => i > 0 ? x.substr(0, 1).toUpperCase() + x.substr(1) : x)
        .join('');
}

/**
 * Find all the children XML tags within <plugin> section.
 * These represent all the plug-ins KonText can use (including
 * the ones not in use in the current configuration).
 *
 * @param {*} doc A DOM document representing parsed config.xml
 */
function findPluginTags(pluginsPath, doc) {
    let plugins = doc.getElementsByTagName('plugins');
    let ans = [];
    function findJsDir(root) {
        let jsm = root.getElementsByTagName('js_module');
        if (jsm.length > 0) {
            return jsm[0].textContent;
        }
        return null;
    }

    if (plugins) {
        for (let i = 0; i < plugins[0].childNodes.length; i += 1) {
            let node = plugins[0].childNodes[i];
            if (node.nodeType === 1) {
                let isEmpty = false;
                let jsDir = findJsDir(node);
                if (!jsDir) {
                    jsDir = camelizeName(node.nodeName);
                    isEmpty = node.getElementsByTagName('module').length === 0;
                }
                ans.push({
                    canonicalName: `@plugins/${canonizeName(node.nodeName)}`,
                    jsDir,
                    jsExists: isEmpty ? false : fs.existsSync(path.resolve(pluginsPath, jsDir))
                });
            }
        }
    }
    return ans;
}

/**
 * Find all the build customization (file build.json) setup
 * of individual plug-ins. Such a customization is only needed
 * in specific situations (legacy JS modules etc.).
 *
 * @param {*} pluginDir A directory path where JS plugins are located
 * @param {*} doc A DOM document representing parsed config.xml
 */
function findAllPluginBuildConf(pluginsDir, doc) {
    let ans = {};
    findPluginTags(pluginsDir, doc).forEach((item) => {
        if (item.jsExists) {
            const dirPath = pluginsDir + '/' + item.jsDir;
            fs.readdirSync(dirPath).forEach(function (filename) {
                if (filename === 'build.json') {
                    ans[item.jsDir] = JSON.parse(fs.readFileSync(dirPath + '/' + filename));
                }
            });
        }
    });
    return ans;
}

function findMatchingEmptyPlugin(jsDirName, pluginsPath) {
    const custom = path.resolve(pluginsPath, 'empty', jsDirName, 'init.ts');
    return fs.existsSync(custom) ? custom : path.resolve(pluginsPath, 'empty/init.ts');
}

export function loadKontextConf (confPath) {
    const data = fs.readFileSync(confPath, {encoding: 'utf8'});
    return new DOMParser().parseFromString(data, 'text/xml');
};

/**
 *
 */
export function findPluginExternalModules (confDoc, jsPath) {
    const pluginsPath = path.resolve(jsPath, 'plugins');
    const pluginBuildConf = findAllPluginBuildConf(pluginsPath, confDoc);
    const ans = [];
    for (let p in pluginBuildConf) {
        const externals = pluginBuildConf[p]['externalModules'] || {};
        for (let p2 in externals) {
            ans.push([p2, externals[p2]]);
        }
    }
    return ans
};

/**
 * Produces mapping for modules with 'fake' (= non filesystem) paths.
 * E.g. 'plugins/taghelper' maps to 'plugins/myCoolTagBuilder'.
 *
 * @param {string} confDoc - parsed KonText XML config
 * @param {string} jsPath - a path to JS/TS plug-ins implementations
 * @param {string} cssPath - a path to core CSS/LESS files
 * @param {boolean} isTypecheck - if true then any unnecessary feature is disabled
 * @return {[fakePath:string]:string}
 */
export function loadModulePathMap (confDoc, jsPath, cssPath, isTypecheck) {
    const pluginsPath = path.resolve(jsPath, 'plugins');
    const langs = findConfiguredLanguages(confDoc);
    let translatPath;
    let cqlParserPath;

    if (isTypecheck) {
        translatPath = path.resolve(jsPath, '..', '..', '..', 'scripts', 'build', 'null');
        cqlParserPath = path.resolve(jsPath, '..', '..', '..', 'scripts', 'build', 'null');

    } else {
        mergeTranslations(jsPath, path.resolve(jsPath, '.compiled/translations.js'), langs);
        translatPath = path.resolve(jsPath, '.compiled/translations');
        cqlParserPath = parseCqlGrammar(jsPath);
    }
    const moduleMap = {
        'translations': translatPath,
        'views': path.resolve(jsPath, 'views'),
        //'vendor/intl-messageformat': path.resolve(jsPath, 'vendor/intl-messageformat.js'),
        'cqlParser/parser': cqlParserPath,
        'misc/keyboardLayouts': path.resolve(jsPath, 'kb-layouts.json'),
        'styles': cssPath
    };
    const pluginBuildConf = findAllPluginBuildConf(pluginsPath, confDoc);
    for (let p in pluginBuildConf) {
        const remapModules = pluginBuildConf[p]['remapModules'] || {};
        for (let p in remapModules) {
            moduleMap[p] = path.resolve(__dirname, '..', '..', 'public', 'files', 'js', remapModules[p]);
        }
    };
    findPluginTags(pluginsPath, confDoc).forEach((item) => {
        if (item.jsExists) {
            moduleMap[item.canonicalName] = path.resolve(pluginsPath, item.jsDir, 'init.ts');

        } else {
            moduleMap[item.canonicalName] = findMatchingEmptyPlugin(item.jsDir, pluginsPath, 'init.ts');
        }
    });
    return moduleMap;
};

function parseCqlGrammar(jsPath) {
    const targetDir = path.resolve(jsPath, '.compiled');
    const grammar = fs.readFileSync(
        path.resolve(__dirname, 'cql.pegjs'),
        {encoding: 'utf-8'}
    );
    // cmd: 'mkdir -p public/files/js/.compiled/cqlParser;
    // ./node_modules/peggy/bin/peggy-cli --format amd
    // --allowed-start-rules Query,RegExpRaw,PhraseQuery
    // -o public/files/js/.compiled/cqlParser/parser.js scripts/build/cql.pegjs'
    const parser = peg.generate(
        grammar,
        {
            allowedStartRules: ['PQuery', 'Query', 'RegExpRaw' , 'PhraseQuery', 'WithinContainingPart', 'Sequence'],
            output: 'source',
            format: 'es',
            trace: true
        }
    );
    const filePath = path.resolve(targetDir, 'parser.js');
    fs.writeFileSync(filePath, parser);
    return filePath;
}

function findConfiguredLanguages(confDoc) {
    const glb = confDoc.getElementsByTagName('global');
    const trn = glb[0].getElementsByTagName('translations');
    const items = trn[0].childNodes;
    const ans = [];
    for (let i = 0; i < items.length; i += 1) {
        if (items[i].nodeType === 1) {
            const tmp = items[i].textContent.trim();
            if (tmp.length > 0) {
                ans.push(tmp);
            }
        }
    }
    validateLanguageCodes(ans);
    console.log('\x1b[44m', 'Configured UI translations:', '\x1b[0m', '\x1b[33m', '\n', ans.join(', '), "\x1b[0m", '\n');
    return ans;
}

function findAllMessageFiles(startDir) {
    let ans = [];
    fs.readdirSync(startDir).forEach((item) => {
        let fullPath = startDir + '/' + item;
        if (fs.lstatSync(fullPath).isDirectory() && ['min'].indexOf(item) === -1) {
            ans = ans.concat(findAllMessageFiles(fullPath));

        } else if (item.match(/messages(\.[a-zA-Z]{1,8})?\.json/)) {
            ans.push(fullPath);
        }
    });
    return ans;
}

function validateLanguageCodes(codeList) {
    codeList.forEach((item, i) => {
        if (item.match(/^[a-z]{1,8}_[A-Za-z0-9]{1,8}$/)) {
            console.log('\x1b[31m', `WARNING: Invalid language format - please use ${item.replace('_', '-')} instead of ${item}`, '\x1b[0m');
            codeList[i] = item.replace('_','-');
            console.log('  (auto-fixed)', '\n');
        }
    })
}

function mergeTranslations(startDir, destFile, configuredLangs) {
    let files = findAllMessageFiles(startDir);
    let translations = {};
    files.forEach((item) => {
        const data = JSON.parse(fs.readFileSync(item));
        validateLanguageCodes(Object.keys(data));
        Object.keys(data).forEach(avail => {
            if (configuredLangs.indexOf(avail) === -1) {
                delete data[avail];
            }
        })
       translations = merge.recursive(translations, data);
    });
    if (!destFile || destFile.length === 0) {
        throw new Error('No target file for client-side translations specified');

    } else if (Object.prototype.toString.call(destFile) !== '[object Array]') {
        destFile = [destFile];
    }
    destFile.forEach((destItem) => {
        fs.writeFileSync(destItem, "export default " + JSON.stringify(translations) + ";\n");
    });
}

function findPathPrefixNode(confDoc, nodeName) {
    let globalNode;
    const rootElm = confDoc.documentElement;
    for (let i = 0; i < rootElm.childNodes.length; i += 1) {
        if (rootElm.childNodes[i].nodeName === 'global') {
            globalNode = rootElm.childNodes[i];
            break;
        }
    }
    if (globalNode) {
        const elms = globalNode.getElementsByTagName(nodeName);
        if (elms.length > 0 && elms[0].textContent) {
            return elms[0].textContent.replace(/\/$/, '');
        }
    }
    return '';
}

export function findActionPathPrefix (confDoc) {
    return findPathPrefixNode(confDoc, 'action_path_prefix');
};

export function findStaticPathPrefix (confDoc) {
    return findPathPrefixNode(confDoc, 'static_files_prefix');
};

