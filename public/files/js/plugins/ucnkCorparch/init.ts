/*
 * Copyright (c) 2015 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
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

/// <reference path="./view.d.ts" />
/// <reference path="../../types/views.d.ts" />

import {Kontext} from '../../types/common';
import {CorplistItemUcnk} from './common';
import {CorplistPage} from './corplist';
import {IPluginApi} from '../../types/plugins';
import {init as viewInit} from './view';
import {init as overviewViewInit} from 'views/overview';
import {CorplistFormStore, CorplistTableStore} from './corplist';
import {QueryStore} from '../../stores/query/main';
import * as dcInit from '../defaultCorparch/init';

/**
 *
 * @param pluginApi
 * @returns {CorplistPage}
 */
export function initCorplistPageComponents(pluginApi:IPluginApi):CorplistPage {
    const overviewViews = overviewViewInit(
        pluginApi.dispatcher(),
        pluginApi.getComponentHelpers(),
        pluginApi.getStores().corpusInfoStore
    );
    const initViews = (formStore:CorplistFormStore, listStore:CorplistTableStore) => {
        const ans:any = viewInit(
            pluginApi.dispatcher(),
            pluginApi.getComponentHelpers(),
            overviewViews.CorpusInfoBox,
            formStore,
            listStore
        );
        return ans;
    }
    return new CorplistPage(pluginApi, initViews);
}

/**
 *
 * @param targetAction
 * @param pluginApi
 * @param queryStore
 * @param querySetupHandler
 * @param options
 */
export function createWidget(targetAction:string, pluginApi:IPluginApi,
        queryStore:QueryStore, querySetupHandler:Kontext.QuerySetupHandler, options:any):React.ComponentClass {
    return dcInit.createWidget(targetAction, pluginApi, queryStore, querySetupHandler, options);
}