/*
 * Copyright (c) 2018 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
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

import { IUnregistrable } from '../../models/common/common';
import { GeneralProps } from '../kontext';
import { BasePlugin, IPluginApi } from './common';

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
export interface CorplistItemClick {
    (corpora:Array<string>, subcorpId:string):void;
}

export type WidgetView = React.ComponentClass<{}>;

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

export interface IPlugin extends IUnregistrable, BasePlugin {

    /**
     * Create a corpus selection widget used on the query page
     */
    createWidget(targetAction:string,
        options:GeneralProps):React.ComponentClass<{}>;

    initCorplistPageComponents(initialData:any):ICorplistPage;
}

export interface Factory {
    (pluginApi:IPluginApi):IPlugin;
}
