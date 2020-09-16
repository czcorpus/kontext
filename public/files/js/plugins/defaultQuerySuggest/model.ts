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
import { StatelessModel, IActionDispatcher, SEDispatcher } from 'kombo';
import { Observable, of as rxOf } from 'rxjs';
import { MultiDict } from '../../multidict';
import { List, HTTP, Ident, Dict } from 'cnc-tskit';
import { map, tap } from 'rxjs/operators';
import { QueryType } from '../../models/query/common';
import { Actions as QueryActions, ActionName as QueryActionName } from '../../models/query/actions';


export interface HTTPResponse extends Kontext.AjaxResponse {
    items:Array<{
        renderer:string;
        contents:Array<{}>;
        heading:string;
    }>;
}

export interface ProviderInfo {
    ident:string;
    frontendId:string;
    queryTypes:Array<QueryType>;
    heading:string;
}

export interface ModelState {
    isBusy:boolean;
    uiLang:string;
    providers:Array<ProviderInfo>;
    suggestionArgs:{[sourceId:string]:PluginInterfaces.QuerySuggest.SuggestionArgs};
    activeSourceId:string;
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
                state.suggestionArgs = Dict.map(
                    v => ({...v, subcorpus: action.payload.subcorp}),
                    state.suggestionArgs
                );
            },
            (state, action, dispatch) => {
                if (state.activeSourceId) {
                    this.loadSuggestions(
                        state,
                        state.suggestionArgs[state.activeSourceId],
                        dispatch
                    );
                }
            }
        );

        this.addActionHandler<QueryActions.QueryInputSelectType>(
            QueryActionName.QueryInputSelectType,
            (state, action) => {
                const currArgs = state.suggestionArgs[action.payload.sourceId];
                if (currArgs) {
                    currArgs.queryType = action.payload.queryType;
                }
            },
            (state, action, dispatch) => {
                const currArgs = state.suggestionArgs[action.payload.sourceId];
                if (currArgs) {
                    this.loadSuggestions(state, currArgs, dispatch);
                }
            }
        );

        this.addActionHandler<PluginInterfaces.QuerySuggest.Actions.AskSuggestions>(
            PluginInterfaces.QuerySuggest.ActionName.AskSuggestions,
            (state, action) => {
                state.isBusy = true;
                state.suggestionArgs[action.payload.sourceId] = {...action.payload};
                state.activeSourceId = action.payload.sourceId;
            },
            (state, action, dispatch) => {
                this.loadSuggestions(state, action.payload, dispatch);
            }
        );

        this.addActionHandler<PluginInterfaces.QuerySuggest.Actions.SuggestionsReceived>(
            PluginInterfaces.QuerySuggest.ActionName.SuggestionsReceived,
            (state, action) => {
                state.isBusy = false;
                if (!action.error) {
                    const cacheIdx = List.findIndex(
                        ([hash,]) => hash === this.createSuggestionHash(
                            action.payload, action.payload.parsedWord),
                        state.cache
                    );

                    if (cacheIdx === -1) {
                        state.cache.push([
                            this.createSuggestionHash(action.payload, action.payload.parsedWord),
                            {
                                results: action.payload.results,
                                parsedValue: action.payload.parsedWord
                            }
                        ]);
                        if (state.cache.length > this.CACHE_SIZE) {
                            state.cache = List.tail(state.cache);
                        }

                    } else {
                        const item = state.cache.splice(cacheIdx, 1);
                        state.cache.push(item[0]);
                    }
                }
            }
        );
    }

    private createSuggestionHash(args:PluginInterfaces.QuerySuggest.SuggestionArgs, srchWord:string):string {
        return Ident.hashCode(
            args.corpora + args.posAttr + args.queryType + args.sourceId +
            args.struct + args.structAttr + args.subcorpus + srchWord + args.valueType);
    }

    private loadSuggestions(
        state:ModelState,
        args:PluginInterfaces.QuerySuggest.SuggestionArgs,
        dispatch:SEDispatcher

    ):void {
        if (Model.supportsQueryType(state, args.queryType)) {
            this.fetchSuggestions(
                state,
                args

            ).subscribe(
                data => {
                    dispatch<PluginInterfaces.QuerySuggest.Actions.SuggestionsReceived>({
                        name: PluginInterfaces.QuerySuggest.ActionName.SuggestionsReceived,
                        payload: {
                            ...args,
                            results: data.results,
                            parsedWord: data.parsedValue
                        }
                    });
                },
                err => {
                    dispatch<PluginInterfaces.QuerySuggest.Actions.SuggestionsReceived>({
                        name: PluginInterfaces.QuerySuggest.ActionName.SuggestionsReceived,
                        payload: {
                            ...args,
                            results: [],
                            parsedWord: ''
                        },
                        error: err
                    });
                }
            );

        } else {
            dispatch<PluginInterfaces.QuerySuggest.Actions.SuggestionsReceived>({
                name: PluginInterfaces.QuerySuggest.ActionName.SuggestionsReceived,
                payload: {
                    ...args,
                    results: [],
                    parsedWord: ''
                }
            });
        }
    }

    private findCursorWord(args:PluginInterfaces.QuerySuggest.SuggestionArgs):string {
        const ans:Array<[string, number, number]> = [];
        let curr:[string, number, number] = ['', 0, 0];
        for (let i = 0; i < args.value.length; i++) {
            if (args.value[i] === ' ' || i === 0) {
                if (curr) {
                    ans.push(curr);
                }
                curr = [args.value[i] === ' ' ? '' : args.value[i], i, i + 1];

            } else {
                curr[0] += args.value[i];
                curr[2] = i + 1;
            }
        }
        ans.push(curr);
        for (let i = 0; i < ans.length; i++) {
            const [w, f, t] = ans[i];
            if (args.rawFocusIdx >= f && args.rawFocusIdx <= t) {
                return w;
            }
        }
        return '';
    }


    private fetchSuggestions(
        state:ModelState,
        suggArgs:PluginInterfaces.QuerySuggest.SuggestionArgs

    ):Observable<PluginInterfaces.QuerySuggest.SuggestionAnswer> {
        const srchWord = this.findCursorWord(suggArgs);
        const cacheIdx = List.findIndex(
            ([key,]) => key === this.createSuggestionHash(suggArgs, srchWord),
            state.cache
        );
        if (cacheIdx > -1) {
            return rxOf(state.cache[cacheIdx][1]);
        }

        const args = new MultiDict<{
            ui_lang:string;
            corpname:string;
            subcorpus:string;
            align:string;
            value:string;
            value_type:PluginInterfaces.QuerySuggest.SuggestionValueType;
            query_type:string;
            p_attr:string;
            struct:string;
            s_attr:string;
        }>();

        args.set('ui_lang', state.uiLang);
        args.set('corpname', List.head(suggArgs.corpora));
        args.set('subcorpus', suggArgs.subcorpus);
        args.replace('align', List.tail(suggArgs.corpora));
        args.set('value', srchWord);
        args.set('value_type', suggArgs.valueType);
        args.set('query_type', suggArgs.queryType);
        args.set('p_attr', suggArgs.posAttr);
        args.set('struct', suggArgs.struct);
        args.set('s_attr', suggArgs.structAttr);

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
                    ),
                    parsedValue: srchWord
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