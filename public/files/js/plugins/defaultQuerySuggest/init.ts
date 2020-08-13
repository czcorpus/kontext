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
import { init as initView, Views as DefaultRenderers } from './view';
import { KnownRenderers, Model } from './model';


declare var require:any;
require('./style.less');


/**
 *
 */
export class DefaultQuerySuggest implements PluginInterfaces.QuerySuggest.IPlugin {

    protected readonly pluginApi:IPluginApi;

    protected readonly views:DefaultRenderers;

    protected readonly providers:Array<string>;

    protected readonly model:Model;

    constructor(pluginApi:IPluginApi, views:DefaultRenderers, model:Model, providers:Array<string>) {
        this.pluginApi = pluginApi;
        this.views = views;
        this.model = model;
        this.providers = providers;

    }

    isActive():boolean {
        return true;
    }

    selectRenderer(typeId:string):React.ComponentClass<{}>|React.SFC<{}> {
        switch (typeId) {
            case KnownRenderers.ERROR:
                return this.views.ErrorRenderer;
            case KnownRenderers.BASIC:
                return this.views.BasicRenderer;
            default:
                return this.views.UnsupportedRenderer;
        }
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
            answers: {}
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
