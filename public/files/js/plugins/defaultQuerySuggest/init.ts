/*
 * Copyright (c) 2020 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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

import { List } from 'cnc-tskit';

import { PluginInterfaces, IPluginApi } from '../../types/plugins';
import { init as initView, SuggestionsViews, KnownRenderers } from './view';
import { Model } from './model';
import { QueryType } from '../../models/query/common';


declare var require:any;
require('./style.less');


/**
 *
 */
export class DefaultQuerySuggest implements PluginInterfaces.QuerySuggest.IPlugin {

    protected readonly pluginApi:IPluginApi;

    protected readonly views:SuggestionsViews;

    protected readonly providers:Array<string>;

    protected readonly model:Model;

    constructor(
        pluginApi:IPluginApi,
        views:SuggestionsViews,
        model:Model,
        providers:Array<string>
    ) {
        this.pluginApi = pluginApi;
        this.views = views;
        this.model = model;
        this.providers = providers;

    }

    isActive():boolean {
        return true;
    }

    supportsQueryType(qtype:QueryType):boolean {
        return true; // TODO (load data from server)
    }

    createComponent(rendererId:string):React.ComponentClass<{
        data:unknown|string|Error|Array<string>
    }>|React.SFC<{
        data:unknown|string|Error|Array<string>
    }> {
        switch (rendererId) {
            case KnownRenderers.ERROR:
                return this.views.error
            case KnownRenderers.BASIC:
                return this.views.basic
            default:
                return this.views.unsupported;
        }
    }

}


export function typeGuard(data:unknown):unknown|Error|string|Array<string> {
    if (typeof data === 'string') {
        return data as string;
    } else if (data instanceof Error) {
        return data as Error;
    } else if (data instanceof Array && List.every(v => typeof v === 'string', data)) {
        return data as Array<string>;
    } else {
        return data;
    }
}


const create:PluginInterfaces.QuerySuggest.Factory = (pluginApi) => {
    const model = new Model(
        pluginApi.dispatcher(),
        {
            corpora: List.concat(
                pluginApi.getConf('alignedCorpora'),
                [pluginApi.getCorpusIdent().id]
            ),
            subcorpus: pluginApi.getCorpusIdent().usesubcorp,
            isBusy: false,
            answers: {},
            currQueryHash: ''
        },
        pluginApi
    );
    return new DefaultQuerySuggest(
        pluginApi,
        initView(pluginApi.dispatcher(), model, pluginApi.getComponentHelpers()),
        model,
        pluginApi.getNestedConf<Array<string>>('pluginData', 'query_suggest')
    );
};

export default create;
