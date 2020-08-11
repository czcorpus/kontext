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

import { PluginInterfaces, IPluginApi } from '../../types/plugins';
import { Kontext } from '../../types/common';
import { StatelessModel, IActionDispatcher } from 'kombo';
import { Observable } from 'rxjs';
import { MultiDict } from '../../multidict';
import { List, HTTP } from 'cnc-tskit';
import { map, tap } from 'rxjs/operators';


export enum KnownRenderers {
    MESSAGE = 'custom-message',
    ERROR = 'error'
}

export interface HTTPResponse extends Kontext.AjaxResponse {
    items:Array<{
        renderer:string;
        contents:Array<[string, string]>;
        found:boolean;
        heading:string;
    }>;
}


export interface ModelState {
    isBusy:boolean;
    corpora:Array<string>;
    subcorpus:string;
    answers:{[hash:string]:PluginInterfaces.QuerySuggest.SuggestionAnswer};
}


export class Model extends StatelessModel<ModelState> {

    private readonly pluginApi:IPluginApi;

    constructor(dispatcher:IActionDispatcher, state:ModelState, pluginApi:IPluginApi) {
        super(dispatcher, state);
        this.pluginApi = pluginApi;

        // TODO add action handler to reflect subcorpus change
    }



    fetchSuggestion(state:ModelState):Observable<PluginInterfaces.QuerySuggest.SuggestionAnswer> {
        const args = new MultiDict();
        args.set('corpname', state.corpora[0]);
        args.replace('align', List.slice(1, -1, state.corpora));

        return this.pluginApi.ajax$<HTTPResponse>(
            HTTP.Method.GET,
            this.pluginApi.createActionUrl('fetch_query_suggestions'),
            args

        ).pipe(
            tap(
                data => {
                    console.log('response: ', data);
                }
            ),
            map(
                (data) => ({
                    answers: []
                })
            )
        );
    }
}