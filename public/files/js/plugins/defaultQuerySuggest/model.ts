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
import { List, HTTP, Ident, Dict, pipe, id, tuple } from 'cnc-tskit';
import { map, tap, concatMap, mergeMap, scan } from 'rxjs/operators';
import { Actions as QueryActions, ActionName as QueryActionName } from '../../models/query/actions';
import { cutLongResult, isBasicFrontend, isPosAttrPairRelFrontend, listAttrs1ToExtend, mergeResults,
    isErrorFrontend, filterOutTrivialSuggestions} from './frontends';
import { AnyProviderInfo, supportsRequest } from './providers';
import { Actions, ActionName } from './actions';
import { QuerySuggestion, QueryType } from '../../models/query/query';


export interface HTTPResponse extends Kontext.AjaxResponse {
    items:Array<{
        renderer:string;
        provider:string;
        contents:Array<{}>;
        heading:string;
        is_active:boolean;
    }>;
}

export interface ModelState {
    isBusy:boolean;
    uiLang:string;
    providers:Array<AnyProviderInfo>;
    suggestionArgs:{[sourceId:string]:PluginInterfaces.QuerySuggest.SuggestionArgs};
    activeSourceId:string;
    cache:Array<[string, PluginInterfaces.QuerySuggest.SuggestionAnswer]>;
}


function listUnion<T>(key:(v:T)=>string, items:Array<Array<T>>):Array<T> {
    return pipe(
        items,
        List.flatMap(v => v),
        List.groupBy(key),
        List.map(([,grouped]) => grouped[0]) // we assume all the grouped items are equivalent
    );
}

function someSupportRequest(infos:Array<AnyProviderInfo>, req:PluginInterfaces.QuerySuggest.SuggestionArgs):boolean {
    return List.some(info => supportsRequest(info, req), infos);
}

function isValidQuery(suggestionArgs:PluginInterfaces.QuerySuggest.SuggestionArgs):boolean {
    if (suggestionArgs.valueSubformat === 'regexp') {
        try {
            new RegExp(suggestionArgs.value)
        } catch(e) {
            return false;
        }
    }
    return true;
}


export function isEmptyResponse<T>(v:QuerySuggestion<T>):boolean {
    if (v === undefined) {
        return true;
    }
    const data = v.contents;
    if (isBasicFrontend(v)) {
        return List.empty(v.contents);

    } else if (isPosAttrPairRelFrontend(v)) {
        return Dict.empty(v.contents.data);

    } else if (isErrorFrontend(v)) {
        return false;
    }
    return !!data;
}

/**
 *
 */
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

        this.addActionHandler<QueryActions.QueryInputSetQType>(
            QueryActionName.QueryInputSetQType,
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
                if (isValidQuery(action.payload) && someSupportRequest(state.providers, action.payload)) {
                    state.isBusy = true;
                    state.suggestionArgs[action.payload.sourceId] = {...action.payload};
                    state.activeSourceId = action.payload.sourceId;
                }
            },
            (state, action, dispatch) => {
                if (isValidQuery(action.payload) && someSupportRequest(state.providers, action.payload)) {
                    dispatch<PluginInterfaces.QuerySuggest.Actions.SuggestionsRequested>({
                        name: PluginInterfaces.QuerySuggest.ActionName.SuggestionsRequested,
                        payload: {...action.payload}
                    });
                    this.loadSuggestions(state, action.payload, dispatch);
                }
            }
        );

        this.addActionHandler<Actions.CacheData>(
            ActionName.CacheData,
            (state, action) => {
                const [cached, cacheIdx] = this.fetchFromCache(
                    state, action.payload, action.payload.parsedWord);
                if (cached) {
                    const item = state.cache.splice(cacheIdx, 1);
                    state.cache.push(item[0]);

                } else {
                    state.cache.push([
                        this.createSuggestionHash(action.payload, action.payload.parsedWord),
                        {
                            results: action.payload.results,
                            parsedWord: action.payload.parsedWord,
                            isPartial: action.payload.isPartial
                        }
                    ]);
                    if (state.cache.length > this.CACHE_SIZE) {
                        state.cache = List.tail(state.cache);
                    }
                }
            }
        );
    }

    private createSuggestionHash(
        args:PluginInterfaces.QuerySuggest.SuggestionArgs,
        srchWord:string

    ):string {
        return Ident.hashCode(
            args.corpora + args.posAttr + args.queryType + args.sourceId +
            args.struct + args.structAttr + args.subcorpus + srchWord + args.valueType +
            args.valueSubformat);
    }



    private loadSuggestions(
        state:ModelState,
        args:PluginInterfaces.QuerySuggest.SuggestionArgs,
        dispatch:SEDispatcher

    ):void {
        if (Model.supportsQueryType(state, args.queryType)) {
            this.fetchSuggestions(
                state,
                args,
                args.value,
                dispatch

            ).pipe(
                tap(
                    data => {
                        const isPartial = pipe(
                            data.results,
                            List.map(
                                item => listAttrs1ToExtend(item)
                            ),
                            List.some(x => !List.empty(x))
                        );
                        dispatch<PluginInterfaces.QuerySuggest.Actions.SuggestionsReceived>({
                            name: PluginInterfaces.QuerySuggest.ActionName.SuggestionsReceived,
                            payload: {
                                ...args,
                                results: pipe(
                                        data.results,
                                        isPartial ? List.map(v => v) : List.map(filterOutTrivialSuggestions),
                                        List.map(cutLongResult)
                                ),
                                parsedWord: data.parsedWord,
                                isPartial
                            }
                        });
                    }
                ),
                concatMap(
                    data => rxOf(...pipe(
                        data.results,
                        List.map(
                            item => listAttrs1ToExtend(item)
                        ),
                        v => listUnion(id, v)

                    )).pipe(
                        mergeMap(
                            data => this.fetchSuggestionsForWord(state, args, data, dispatch)
                        ),
                        scan(
                            (acc, curr) => ({
                                results: pipe(
                                    acc.results,
                                    List.zip(curr.results),
                                    List.map(
                                        ([values1, values2]) => cutLongResult(
                                            mergeResults(values1, values2)
                                        )
                                    )
                                ),
                                parsedWord: acc.parsedWord,
                                isPartial: false
                            }),
                            data
                        )
                    )
                )
            ).subscribe(
                data => {
                    dispatch<PluginInterfaces.QuerySuggest.Actions.SuggestionsReceived>({
                        name: PluginInterfaces.QuerySuggest.ActionName.SuggestionsReceived,
                        payload: {
                            ...args,
                            results: List.map(filterOutTrivialSuggestions, data.results),
                            parsedWord: data.parsedWord,
                            isPartial: data.isPartial
                        }
                    });
                },
                err => {
                    dispatch<PluginInterfaces.QuerySuggest.Actions.SuggestionsReceived>({
                        name: PluginInterfaces.QuerySuggest.ActionName.SuggestionsReceived,
                        payload: {
                            ...args,
                            results: [],
                            parsedWord: '',
                            isPartial: false
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
                    parsedWord: '',
                    isPartial: false
                }
            });
        }
    }

    private fetchSuggestions(
        state:ModelState,
        suggArgs:PluginInterfaces.QuerySuggest.SuggestionArgs,
        word:string,
        dispatch:SEDispatcher

    ):Observable<PluginInterfaces.QuerySuggest.SuggestionAnswer> {
        return this.fetchSuggestionsForWord(
            state,
            suggArgs,
            word,
            dispatch
        );
    }

    private fetchFromCache(
        state:ModelState,
        suggArgs:PluginInterfaces.QuerySuggest.SuggestionArgs,
        word:string
    ):[PluginInterfaces.QuerySuggest.SuggestionAnswer, number]|undefined {
        const cacheIdx = List.findIndex(
            ([key,]) => key === this.createSuggestionHash(suggArgs, word),
            state.cache
        );
        if (cacheIdx > -1) {
            return tuple(state.cache[cacheIdx][1], cacheIdx);
        }
        return [undefined, -1];
    }

    private fetchSuggestionsForWord(
        state:ModelState,
        suggArgs:PluginInterfaces.QuerySuggest.SuggestionArgs,
        word:string,
        dispatch:SEDispatcher

    ):Observable<PluginInterfaces.QuerySuggest.SuggestionAnswer> {
        const [cached,] = this.fetchFromCache(state, suggArgs, word);
        if (cached) {
            return rxOf(cached);
        }

        const args = new MultiDict<{
            ui_lang:string;
            corpname:string;
            subcorpus:string;
            align:string;
            value:string;
            value_type:PluginInterfaces.QuerySuggest.SuggestionValueType;
            value_subformat:PluginInterfaces.QuerySuggest.QueryValueSubformat,
            query_type:string;
            p_attr:string;
            struct:string;
            s_attr:string;
        }>();

        args.set('ui_lang', state.uiLang);
        args.set('corpname', List.head(suggArgs.corpora));
        args.set('subcorpus', suggArgs.subcorpus);
        args.replace('align', List.tail(suggArgs.corpora));
        args.set('value', word);
        args.set('value_type', suggArgs.valueType);
        args.set('value_subformat', suggArgs.valueSubformat);
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
                            providerId: item.provider,
                            contents: item.contents,
                            heading: item.heading,
                            isShortened: false,
                            isActive: item.is_active
                        }),
                        data.items
                    ),
                    parsedWord: word,
                    isPartial: false // yet to be resolved
                })
            ),
            tap(
                data => {
                    dispatch<Actions.CacheData>({
                        name: ActionName.CacheData,
                        payload: {
                            ...suggArgs,
                            ...data
                        }
                    })
                }
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