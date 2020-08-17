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
import { QueryType } from '../../models/query/common';


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
    uiLang:string;

    // TODO - remove the property as it should be part of QueryFormModelState
    // also, no caching will be used there
    answers:{[hash:string]:PluginInterfaces.QuerySuggest.SuggestionAnswer};
    currQueryHash:string;
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
                this.fetchSuggestion(
                    state,
                    action.payload.value,
                    action.payload.queryType,
                    action.payload.posAttr,
                    action.payload.struct,
                    action.payload.structAttr
                ).subscribe(
                    data => {
                        dispatch<PluginInterfaces.QuerySuggest.Actions.SuggestionsReceived>({
                            name: PluginInterfaces.QuerySuggest.ActionName.SuggestionsReceived,
                            payload: {
                                results: data.results,
                                value: action.payload.value,
                                sourceId: action.payload.sourceId
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
                state.answers[action.payload.value] = {
                    results: action.payload.results
                };
            }
        );
    }



    fetchSuggestion(
        state:ModelState,
        value:string,
        queryType:QueryType,
        posattr:string,
        struct:string,
        structAttr:string
    ):Observable<PluginInterfaces.QuerySuggest.SuggestionAnswer> {

        const args = new MultiDict();
        args.set('ui_lang', state.uiLang);
        args.set('corpname', state.corpora[0]);
        args.replace('align', List.slice(1, -1, state.corpora));
        args.set('value', value);
        args.set('query_type', queryType);
        args.set('posattr', posattr);
        args.set('struct', struct);
        args.set('struct_attr', structAttr);

        return this.pluginApi.ajax$<HTTPResponse>(
            HTTP.Method.GET,
            this.pluginApi.createActionUrl('fetch_query_suggestions'),
            args

        ).pipe(
            map(
                data => ({
                    results: List.map(
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