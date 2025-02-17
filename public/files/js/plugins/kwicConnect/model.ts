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

import * as PluginInterfaces from '../../types/plugins/index.js';
import * as Kontext from '../../types/kontext.js';
import * as ttResponse from '../../models/concordance/ttdist/response.js';
import { Actions as ConcActions } from '../../models/concordance/actions.js';
import { Actions as QueryActions } from '../../models/query/actions.js';
import { StatefulModel, IFullActionControl } from 'kombo';
import { Observable, of as rxOf, concat } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { FreqServerArgs } from '../../models/freqs/regular/common.js';
import { HTTP, List } from 'cnc-tskit';
import { Actions } from './actions.js';
import { IPluginApi } from '../../types/plugins/common.js';
import { HighlightAttrMatch, mergeHighlightItems } from '../../models/concordance/main.js';


export enum KnownRenderers {
    DISPLAY_LINK = 'display-link',
    RAW_HTML = 'raw-html',
    DATAMUSE = 'datamuse-json',
    TREQ = 'treq-json',
    SIMPLE_TABULAR = 'simple-tabular',
    SIMPLE_DESCRIPTION_LIST = 'simple-description-list',
    MESSAGE = 'custom-message',
    ERROR = 'error',
    FORMATTED_TEXT = 'formatted-text'
}


export interface RendererMap {
    (id:KnownRenderers):PluginInterfaces.TokenConnect.Renderer;
}


export interface ProviderOutputResponse {
    heading:string;
    note:string;
    renderer:KnownRenderers;
    data:Array<{
        status:boolean;
        kwic:string;
        contents:any; // TODO should be unknown
    }>;
}

interface AjaxResponseFetchData extends Kontext.AjaxResponse {
    data:Array<ProviderOutputResponse>;
}

interface AjaxResponseListProviders extends Kontext.AjaxResponse {
    providers:Array<{id:string, label:string}>;
}

export interface ProviderOutput {
    found:boolean;
    kwic:string;
    contents:any; // TODO should be unknown
}

export interface ProviderWordMatch {
    heading:string;
    note:string;
    renderer:PluginInterfaces.TokenConnect.Renderer;
    data:Array<ProviderOutput>;
    highlights:{[value:string]:boolean};
}

export interface KwicConnectState {
    isBusy:boolean;
    corpora:Array<string>;
    mainCorp:string;
    freqType:FreqDistType;
    data:Array<ProviderWordMatch>;
    blockedByAsyncConc:boolean;
    hasOmittedItems:boolean;
    highlightItems:Array<HighlightAttrMatch>;
}


export enum FreqDistType {
    WORD = 'word',
    LEMMA = 'lemma'
}


export interface KwicConnectModelArgs {
    dispatcher:IFullActionControl;
    pluginApi:IPluginApi;
    corpora:Array<string>;
    mainCorp:string;
    rendererMap:RendererMap;
    loadChunkSize:number;
    maxKwicWords:number;
    isUnfinishedCalculation:boolean;
}

export class KwicConnectModel extends StatefulModel<KwicConnectState> {

    private static UNIQ_KWIC_FREQ_PAGESIZE = 10;

    private static MAX_WORDS_PER_PHRASE = 2;

    private pluginApi:IPluginApi;

    private rendererMap:RendererMap;

    private loadChunkSize:number;

    private maxKwicWords:number;

    constructor({
            dispatcher,
            pluginApi,
            corpora,
            mainCorp,
            rendererMap,
            loadChunkSize,
            maxKwicWords,
            isUnfinishedCalculation
    }:KwicConnectModelArgs) {
        super(
            dispatcher,
            {
                isBusy: false,
                data: [],
                corpora,
                mainCorp,
                freqType: FreqDistType.LEMMA,
                blockedByAsyncConc: isUnfinishedCalculation,
                hasOmittedItems: false,
                highlightItems: []
            }
        );
        this.pluginApi = pluginApi;
        this.rendererMap = rendererMap;
        this.loadChunkSize = loadChunkSize;
        this.maxKwicWords = maxKwicWords;

        this.addActionHandler(
            PluginInterfaces.KwicConnect.Actions.FetchInfo,
            state => {
                if (List.empty(this.state.data)) {
                    this.changeState(state => {
                        state.isBusy = true;
                    });
                }
                if (!this.state.blockedByAsyncConc && List.empty(this.state.data)) {
                    this.waitForActionWithTimeout(5000, {}, (action, syncData) => {
                        if (ConcActions.isConcordanceRecalculationReady(action)) {
                            return null;
                        }
                        return syncData;

                    }).subscribe({
                        next: action => {
                            if (ConcActions.isConcordanceRecalculationReady(action)) {
                                this.loadData(action.payload.overviewMinFreq);
                            }
                        },
                        error: error => {
                            this.pluginApi.showMessage('error', error);
                        }
                    });
                }

            }
        );

        this.addActionHandler(
            QueryActions.BranchQuery,
            state => {
                this.changeState(state => {
                    state.data = [];
                });
                if (!this.state.blockedByAsyncConc) {
                    this.waitForActionWithTimeout(5000, {}, (action, syncData) => {
                        if (ConcActions.isConcordanceRecalculationReady(action)) {
                            return null;
                        }
                        return syncData;

                    }).subscribe({
                        next: action => {
                            if (ConcActions.isConcordanceRecalculationReady(action)) {
                                this.loadData(action.payload.overviewMinFreq);
                            }
                        },
                        error: error => {
                            this.pluginApi.showMessage('error', error);
                        }
                    });
                }
            }
        );

        this.addActionHandler<typeof Actions.FetchPartialInfoDone>(
            Actions.FetchPartialInfoDone.name,
            action => {
                this.changeState(state => {
                    this.mergeDataOfProviders(state, action.payload.data);
                });
            }
        );

        this.addActionHandler<typeof Actions.FetchInfoDone>(
            Actions.FetchInfoDone.name,
            action => {
                this.changeState(state => {
                    state.isBusy = false;
                    state.freqType = action.payload.freqType;
                    this.mergeDataOfProviders(state, action.payload.data);
                });
            }
        );

        this.addActionHandler<typeof ConcActions.AsyncCalculationUpdated>(
            ConcActions.AsyncCalculationUpdated.name,
            action => {
                const prevBlocked = this.state.blockedByAsyncConc;
                this.changeState(state => {
                    state.blockedByAsyncConc = !action.payload.finished;
                });
                if (prevBlocked && !this.state.blockedByAsyncConc) {
                    this.waitForActionWithTimeout(5000, {}, (action, syncData) => {
                        if (ConcActions.isConcordanceRecalculationReady(action)) {
                            return null;
                        }
                        return syncData;

                    }).subscribe({
                        next: action => {
                            if (ConcActions.isConcordanceRecalculationReady(action)) {
                                this.loadData(action.payload.overviewMinFreq);
                            }
                        },
                        error: error => {
                            this.pluginApi.showMessage('error', error);
                        }
                    });
                }
            }
        );

        this.addActionHandler(
            ConcActions.HighlightAttrMatch,
            action => {
                this.changeState(state => {
                    state.highlightItems = mergeHighlightItems(
                        state.highlightItems,
                        action.payload.items,
                        false
                    );
                    state.isBusy = true;
                });
            }
        );

        this.addActionHandler(
            ConcActions.HighlightAttrMatchDone,
            action => {
                if (action.error) {
                    this.pluginApi.showMessage('error', action.error);

                } else {
                    this.changeState(
                        state => {
                            state.highlightItems = action.payload.items;
                            state.isBusy = false;
                        }
                    );
                }
            }
        );

        this.addActionHandler(
            ConcActions.HighlightedTokenMouseover,
            action => {
                this.changeState(
                    state => {
                        List.forEach(
                            pwMatch => {
                                pwMatch.highlights[action.payload.value] = true;
                            },
                            state.data
                        );
                    }
                );
            }
        );

        this.addActionHandler(
            ConcActions.HighlightedTokenMouseout,
            action => {
                this.changeState(
                    state => {
                        List.forEach(
                            pwMatch => {
                                pwMatch.highlights[action.payload.value] = false;
                            },
                            state.data
                        );
                    }
                );
            }
        );
    }

    private loadData(flimit:number):void {
        const freqType = this.selectFreqType();
        this.fetchResponses(freqType, flimit).subscribe({
            next: (data) => {
                this.dispatchSideEffect<typeof Actions.FetchInfoDone>({
                    name: Actions.FetchInfoDone.name,
                    payload: {
                        data,
                        freqType
                    }
                });
            },
            error: (err) => {
                this.pluginApi.showMessage('error', err);
                this.dispatchSideEffect<typeof Actions.FetchInfoDone>({
                    name: Actions.FetchInfoDone.name,
                    payload: {
                        data: [],
                        freqType: null
                    },
                    error: err
                });
            }
        });
    }

    private fetchResponses(
        freqType:FreqDistType,
        flimit:number
    ):Observable<Array<ProviderWordMatch>> {

        return this.fetchUniqValues(freqType, flimit).pipe(
            concatMap(
                (kwics) => {
                    const procItems = List.filter(v => v.split(' ').length <=
                        KwicConnectModel.MAX_WORDS_PER_PHRASE, kwics);
                    const procData = this.makeStringGroups(
                        List.slice(0, this.maxKwicWords, procItems), this.loadChunkSize);
                    let ans:Observable<Array<ProviderWordMatch>>;

                    if (procData.length > 0) {
                        ans = List.reduce(
                            (prev, curr) => prev.pipe(
                                concatMap(
                                    (data) => {
                                        if (data !== null) {
                                            this.dispatchSideEffect<typeof Actions.FetchPartialInfoDone>({
                                                name: Actions.FetchPartialInfoDone.name,
                                                payload: {
                                                    data
                                                }
                                            });
                                        }
                                        return this.fetchKwicInfo(curr);
                                    }
                                )
                            ),
                            rxOf([]),
                            procData
                        );

                    } else {
                        ans = this.pluginApi.ajax$<AjaxResponseListProviders>(
                            HTTP.Method.GET,
                            'get_corpus_kc_providers',
                            {corpname: List.head(this.state.corpora)}

                        ).pipe(
                            concatMap(
                                (data) => rxOf(
                                    List.map(p => ({
                                        heading: p.label,
                                        note: null,
                                        renderer: null,
                                        data: [],
                                        highlights: {}
                                    }), data.providers)
                                )
                            )
                        );
                    }

                    if (procItems.length < kwics.length) {
                        ans = concat(
                            this.pluginApi.ajax$<AjaxResponseListProviders>(
                                HTTP.Method.GET,
                                'get_corpus_kc_providers',
                                {corpname: List.head(this.state.corpora)}

                            ).pipe(
                                concatMap(
                                    (data) => rxOf(
                                        List.map(p => ({
                                            data: [{
                                                found: false,
                                                kwic: null,
                                                contents: this.pluginApi.translate(
                                                    'default_kwic_connect__item_been_ommitted_due_size')
                                            }],
                                            heading: p.label,
                                            note: null,
                                            renderer: this.rendererMap(KnownRenderers.MESSAGE),
                                            highlights: {}
                                        }), data.providers)
                                    )
                                )
                            ),
                            ans
                        );
                    }

                    return ans;
                }
            )
        );


    }

    /**
     */
    private selectFreqType():FreqDistType {
        return FreqDistType.LEMMA;
    }

    /**
     * This for merging data loaded chunk by chunk. KonText asks all the providers
     * for part of kwic words. Each response contains also some global information
     * (e.g. headers). The function ensures that only actual chunked data are
     * concatenated.
     *
     * @param state
     * @param newData
     */
    private mergeDataOfProviders(state:KwicConnectState, newData:Array<ProviderWordMatch>):void {
        if (state.data.length > 0) {
            state.data = List.map((providerData, i) => ({
                heading: providerData.heading,
                note: providerData.note,
                renderer: providerData.renderer,
                data: List.concat(newData[i].data, providerData.data),
                highlights: {}
            }), state.data);

        } else {
            state.data = newData;
        }
    }

    private makeStringGroups(s:Array<string>, chunkSize:number):Array<Array<string>> {
        const ans:Array<Array<string>> = [];
        let chunk:Array<string>;
        s.forEach((v, i) => {
            if (i % chunkSize === 0) {
                if (chunk) {
                    ans.push(chunk);
                }
                chunk = [];
            }
            chunk.push(v);
        });
        if (chunk && chunk.length > 0) {
            ans.push(chunk);
        }
        return ans;
    };

    private fetchKwicInfo(
        items:Array<string>
    ):Observable<Array<ProviderWordMatch>> {

        const args = {
            corpname: this.state.mainCorp,
            align: List.filter(v => v !== this.state.mainCorp, this.state.corpora),
            w: []
        };
        const procItems = List.slice(0, KwicConnectModel.UNIQ_KWIC_FREQ_PAGESIZE, items);
        if (procItems.length > 0) {
            List.forEach(v => args.w.push(v), procItems);
            return this.pluginApi.ajax$<AjaxResponseFetchData>(
                HTTP.Method.GET,
                this.pluginApi.createActionUrl('fetch_external_kwic_info'),
                args

            ).pipe(
                concatMap(
                    (responseData) => {
                        return rxOf(
                            List.map(
                                provider => ({
                                    data: List.map(
                                        item => ({
                                            contents: item.contents,
                                            found: item.status,
                                            kwic: item.kwic
                                        }),
                                        provider.data
                                    ),
                                    heading: provider.heading,
                                    note: provider.note,
                                    renderer: this.rendererMap(provider.renderer),
                                    highlights: {}
                                }),
                                responseData.data
                            )
                        );
                    }
                )
            );

        } else {
            return rxOf([]);
        }
    }

    private fetchUniqValues(fDistType:FreqDistType, flimit:number):Observable<Array<string>> {
        const args:FreqServerArgs = {
            ...this.pluginApi.getConcArgs(),
            freq_type: 'tokens',
            fcrit: `${fDistType}/ie 0~0>0`,
            flimit,
            fpage: 1,
            freq_sort: 'freq',
            fpagesize: KwicConnectModel.UNIQ_KWIC_FREQ_PAGESIZE,
            freqlevel: undefined,
            format: 'json'
        };
        return this.pluginApi.ajax$<ttResponse.FreqData>(
            HTTP.Method.GET,
            this.pluginApi.createActionUrl('freqs'),
            args
        ).pipe(
            concatMap(
                (data) => rxOf(
                    data.Blocks[0].Items.map(
                        item => item.Word.map(w => w.n.replace(/\s+/, ' ')).join(' ')))
            )
        );
    }

}