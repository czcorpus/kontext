/*
 * Copyright (c) 2018 Charles University, Faculty of Arts,
 *                    Department of Linguistics
 * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

import { IUnregistrable } from '../../models/common/common.js';
import { BasePlugin, IPluginApi } from './common.js';
import { FullCorpusIdent, SubcorpListItem } from '../../types/kontext.js';
import { Action } from 'kombo';
import * as Kontext from '../kontext.js';

// ------------------------------------------------------------------------
// ------------------------ [corparch] plug-in ----------------------------

/**
 * This should be 1:1 with a respective Python class in plugins.abstract.corparch.corpus
 */
export interface CorpusInfo {
    id:string;
    name:string;
    description:string;
    _descriptionCs:string|undefined;
    _descriptionEn:string|undefined;
    path:string;
    web:string|undefined;
    sentenceStruct:string|undefined;
    defaultTagset:string|undefined;
    tagsets:Array<{

    }>;
    speechSegment:string|undefined;
    speakerIdAttr:string|undefined;
    speechOverlapAttr:string|undefined;
    speechOverlapVal:string|undefined;
    bibStruct:string|undefined;
    sampleSize:string|undefined;
    featured:boolean;
    collatorLocale:string;
    useSafeFont:boolean;
    citationInfo:{
        defaultRef:string|undefined;
        articleRef:Array<string>;
        otherBibliography:string|undefined;
    };
    metadata:{
        database:string|undefined;
        labelAttr:string|undefined;
        avgLabelAttrLen:number|undefined;
        idAttr:string|undefined;
        sortAttrs:boolean;
        desc:{[lang:string]:string};
        keywords:Array<[string, string]>;
        intervalAttrs:Array<[string, string]>;
        groupDuplicates:boolean;
        defaultVirtKeyboard:string|undefined;
        featured:boolean;
    };
    tokenConnect:{
        providers:Array<unknown>; // TODO item type
    }
    kwicConnect:{
        providers:Array<unknown>; // TODO item type
    }
    manatee:{
        encoding:string|undefined;
        name:string|undefined;
        description:string|undefined;
        attrs:Array<string>;
        size:number;
        has_lemma:boolean;
        tagset_doc:string|undefined;
        lang:string|undefined;
    }
    defaultViewOpts:{[key:string]:string|boolean|number};
    querySuggest:{
        providers:Array<unknown>; // TODO item type
    }
    simpleQueryDefaultAttrs:Array<string>;
}


/**
 * A general click action performed on featured/favorite/searched item
 */
export interface CorpusSelectionHandler {
    (corpora:Array<string>, subcorpId:string):void;
}

export type WidgetView = React.ComponentClass<{
    widgetId:string;
}>;

/**
 * A factory class for generating corplist page. The page is expected
 * to contain two blocks
 *  - a form (typically a filter)
 *  - a dataset (= list of matching corpora)
 *
 */
export interface ICorplistPage {

    getForm():React.ComponentClass|React.FC<{}>;

    getList():React.ComponentClass|React.FC<{}>;
}

export interface InitialWidgetData {
    corpusIdent:Kontext.FullCorpusIdent,
    availableSubcorpora:Array<Kontext.SubcorpListItem>,
}

export interface IPlugin extends IUnregistrable, BasePlugin {

    /**
     * Create a corpus and subcorpus selection widget used on the query page.
     *
     * @param serverAction should specify action name (= part of URL
     * path following the root URL (e.g. 'wordlist_form')). This may
     * or may not be used as some implementations do not rely on full
     * page reload and thus do not need to know the actual URL.
     *
     * @param onCorpusSelection is a callback to handle clicking on
     * favorite corpora, featured corpora, searched corpora and subcorpora
     */
    createWidget(
        widgetId:string,
        serverAction:string,
        onCorpusSelection:CorpusSelectionHandler,
        initialData?:InitialWidgetData,
    ):React.ComponentClass<{widgetId:string}>;

    initCorplistPageComponents(initialData:any):ICorplistPage;
}

export class Actions {
    static SecondaryCorpusChange:Action<{
        widgetId:string;
        corpusIdent:FullCorpusIdent;
        availableSubcorpora:Array<SubcorpListItem>;
        attrList:Array<Kontext.AttrItem>;
    }> = {
        name: 'DEFAULT_CORPARCH_WIDGET_CORPUS_CHANGE'
    };
}

export interface Factory {
    (pluginApi:IPluginApi):IPlugin;
}
