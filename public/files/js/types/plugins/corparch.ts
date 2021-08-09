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
