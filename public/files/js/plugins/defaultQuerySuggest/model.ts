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
import { Observable, of as rxOf } from 'rxjs';
import { MultiDict } from '../../multidict';
import { List, HTTP, tuple } from 'cnc-tskit';
import { map } from 'rxjs/operators';
import { QueryType } from '../../models/query/common';
import { Actions as QueryActions, ActionName as QueryActionName } from '../../models/query/actions';


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
    providers:Array<{frontendId:string; queryTypes:Array<QueryType>}>;
    queryTypes:{[hash:string]:QueryType};
    cache:Array<[string, PluginInterfaces.QuerySuggest.SuggestionAnswer]>;
}


export class Model extends StatelessModel<ModelState> {

    private readonly CACHE_SIZE = 100;

    private readonly pluginApi:IPluginApi;

    constructor(dispatcher:IActionDispatcher, state:ModelState, pluginApi:IPluginApi) {
        super(dispatcher, state);
        this.pluginApi = pluginApi;

        this.addActionHandler<QueryActions.QueryInputSelectSubcorp>(
            QueryActionName.QueryInputSelectSubcorp,
            (state, action) => {
                state.subcorpus = action.payload.subcorp;
            }
        );

        this.addActionHandler<QueryActions.QueryInputSelectType>(
            QueryActionName.QueryInputSelectType,
            (state, action) => {
                state.queryTypes[action.payload.sourceId] = action.payload.queryType;
            }
        );

        this.addActionHandler<PluginInterfaces.QuerySuggest.Actions.AskSuggestions>(
            PluginInterfaces.QuerySuggest.ActionName.AskSuggestions,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                const cacheId = List.findIndex(
                    v => v[0] === `${action.payload.sourceId}-${action.payload.value}`,
                    state.cache
                );

                if (cacheId > -1) {
                    dispatch<PluginInterfaces.QuerySuggest.Actions.SuggestionsReceived>({
                        name: PluginInterfaces.QuerySuggest.ActionName.SuggestionsReceived,
                        payload: {
                            results: state.cache[cacheId][1].results,
                            value: action.payload.value,
                            sourceId: action.payload.sourceId
                        }
                    });

                } else {
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
            }
        );

        this.addActionHandler<PluginInterfaces.QuerySuggest.Actions.SuggestionsReceived>(
            PluginInterfaces.QuerySuggest.ActionName.SuggestionsReceived,
            (state, action) => {
                state.isBusy = false;
                if (action.error === undefined){
                    const cacheId = List.findIndex(
                        v => v[0] === `${action.payload.sourceId}-${action.payload.value}`,
                        state.cache
                    );

                    if (cacheId === -1) {
                        state.cache.push([
                            `${action.payload.sourceId}-${action.payload.value}`,
                            {results: action.payload.results}
                        ]);
                        if (state.cache.length > this.CACHE_SIZE) {
                            state.cache = List.tail(state.cache);
                        }
                    }
                }
            }
        );
    }


    private fetchSuggestion(
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
        args.set('subcorpus', state.subcorpus);
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

    static supportsQueryType(state:ModelState, qtype:QueryType):boolean {
        return List.some(
            v => List.some(
                qt => qt === qtype,
                v.queryTypes
            ),
            state.providers
        );
    }
}