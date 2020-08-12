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
import { map } from 'rxjs/operators';


export enum KnownRenderers {
    MESSAGE = 'custom-message',
    ERROR = 'error'
}

export interface HTTPResponse extends Kontext.AjaxResponse {
    items:Array<{
        renderer:string;
        contents:Array<{}>;
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

        this.addActionHandler<PluginInterfaces.QuerySuggest.Actions.AskSuggestions>(
            PluginInterfaces.QuerySuggest.ActionName.AskSuggestions,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.fetchSuggestion(state).subscribe(
                    data => {
                        dispatch<PluginInterfaces.QuerySuggest.Actions.SuggestionsReceived>({
                            name: PluginInterfaces.QuerySuggest.ActionName.SuggestionsReceived,
                            payload: {
                                answers: data.answers
                            }
                        });
                    },
                    err => {
                        dispatch<PluginInterfaces.QuerySuggest.Actions.SuggestionsReceived>({
                            name: PluginInterfaces.QuerySuggest.ActionName.SuggestionsReceived,
                            error: err
                        });
                    }
                )
            }
        );

        this.addActionHandler<PluginInterfaces.QuerySuggest.Actions.SuggestionsReceived>(
            PluginInterfaces.QuerySuggest.ActionName.SuggestionsReceived,
            (state, action) => {
                state.isBusy = false;
            }
        );
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
            map(
                data => ({
                    answers: List.map(
                        item => ({
                            rendererId: item.renderer,
                            contents: item.contents,
                            heading: item.heading
                        }),
                        data.items
                    )
                })
            )
        );
    }
}