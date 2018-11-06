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

import RSVP from 'rsvp';
import * as Immutable from 'immutable';
import { StatelessModel } from "../../models/base";
import { ActionPayload, ActionDispatcher, typedProps, SEDispatcher } from "../../app/dispatcher";
import { IPluginApi, PluginInterfaces } from "../../types/plugins";
import { Kontext } from "../../types/common";
import {Response as TTDistResponse} from '../../models/concordance/ttDistModel';
import { MultiDict } from '../../util';
import {IConcLinesProvider} from '../../types/concordance';


export interface RendererMap {
    (id:string):PluginInterfaces.TokenConnect.Renderer;
}


export interface ProviderOutputResponse {
    heading:string;
    note:string;
    renderer:string;
    data:Array<{
        status:boolean;
        kwic:string;
        contents:any; // <-- this is up to a concrete renderer/backend
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
    contents:any; // <-- this is up to a concrete renderer/backend
}

export interface ProviderWordMatch {
    heading:string;
    note:string;
    renderer:string;
    data:Immutable.List<ProviderOutput>;
}

export interface KwicConnectState {
    isBusy:boolean;
    corpora:Immutable.List<string>;
    mainCorp:string;
    freqType:FreqDistType;
    data:Immutable.List<ProviderWordMatch>;
    blockedByAsyncConc:boolean;
}

export enum Actions {
    FETCH_INFO_DONE = 'KWIC_CONNECT_FETCH_INFO_DONE',
    FETCH_PARTIAL_INFO_DONE = 'KWIC_CONNECT_FETCH_PARTIAL_INFO_DONE'
}

enum FreqDistType {
    WORD = 'word',
    LEMMA = 'lemma'
}


export interface KwicConnectModelArgs {
    dispatcher:ActionDispatcher;
    pluginApi:IPluginApi;
    corpora:Array<string>;
    mainCorp:string;
    rendererMap:RendererMap;
    concLinesProvider:IConcLinesProvider;
    loadChunkSize:number;
    maxKwicWords:number;
}

export class KwicConnectModel extends StatelessModel<KwicConnectState> {

    private pluginApi:IPluginApi;

    private rendererMap:RendererMap;

    private loadChunkSize:number;

    private maxKwicWords:number;

    private concLinesProvider:IConcLinesProvider;

    constructor({
            dispatcher,
            pluginApi,
            corpora,
            mainCorp,
            rendererMap,
            concLinesProvider,
            loadChunkSize,
            maxKwicWords}:KwicConnectModelArgs) {
        super(
            dispatcher,
            {
                isBusy: false,
                data: Immutable.List<ProviderWordMatch>(),
                corpora: Immutable.List<string>(corpora),
                mainCorp: mainCorp,
                freqType: FreqDistType.LEMMA,
                blockedByAsyncConc: concLinesProvider.isUnfinishedCalculation()
            }
        );
        this.pluginApi = pluginApi;
        this.rendererMap = rendererMap;
        this.loadChunkSize = loadChunkSize;
        this.maxKwicWords = maxKwicWords;
        this.concLinesProvider = concLinesProvider;
    }

    reduce(state:KwicConnectState, action:ActionPayload):KwicConnectState {
        let newState:KwicConnectState;
        switch (action.actionType) {
            case PluginInterfaces.KwicConnect.Actions.FETCH_INFO:
                newState = this.copyState(state);
                if (newState.data.size === 0) {
                    newState.isBusy = true;
                }
                return newState;
            case Actions.FETCH_PARTIAL_INFO_DONE:
                newState = this.copyState(state);
                this.mergeDataOfProviders(newState, action.props['data']);
                return newState;
            case Actions.FETCH_INFO_DONE:
                newState = this.copyState(state);
                newState.isBusy = false;
                newState.freqType = action.props['freqType'];
                this.mergeDataOfProviders(newState, action.props['data']);
                return newState;
            case '@CONCORDANCE_ASYNC_CALCULATION_UPDATED':
                // Please note that this action breaks (de facto) the 'no side effect chain'
                // rule (it is produced by async action of a StatefulModel and triggers a side
                // effect here). But currently we have no solution to this.
                newState = this.copyState(state);
                newState.blockedByAsyncConc = action.props['isUnfinished'];
                return newState;
            default:
                return state;
        }
    }

    sideEffects(state:KwicConnectState, action:ActionPayload, dispatch:SEDispatcher) {
        switch (action.actionType) {
            case PluginInterfaces.KwicConnect.Actions.FETCH_INFO:
            case '@CONCORDANCE_ASYNC_CALCULATION_UPDATED': {
                if (state.blockedByAsyncConc || state.data.size > 0) {
                    return;
                }
                const freqType = this.selectFreqType();
                this.fetchUniqValues(freqType).then(
                    (data) => {
                        const procData = this.makeStringGroups(data.slice(0, this.maxKwicWords),
                                this.loadChunkSize);
                        if (procData.length > 0) {
                            return procData.reduce(
                                (prev, curr) => {
                                    return prev.then(
                                        (data) => {
                                            if (data !== null) {
                                                dispatch({
                                                    actionType: Actions.FETCH_PARTIAL_INFO_DONE,
                                                    props: {
                                                        data: data
                                                    }
                                                });
                                            }
                                            return this.fetchKwicInfo(state, curr);
                                        }
                                    );
                                },
                                RSVP.Promise.resolve(Immutable.List<ProviderWordMatch>())
                            );

                        } else {
                            return this.pluginApi.ajax<AjaxResponseListProviders>(
                                'GET',
                                'get_corpus_kc_providers',
                                {corpname: state.corpora.get(0)}

                            ).then(
                                (data) => {
                                    return Immutable.List<ProviderWordMatch>(data.providers.map(p => {
                                        return {
                                            heading: p.label,
                                            note: null,
                                            renderer: null,
                                            data: Immutable.List<ProviderOutput>()
                                        };
                                    }));
                                }
                            );
                        }
                    }
                ).then(
                    (data) => {
                        dispatch({
                            actionType: Actions.FETCH_INFO_DONE,
                            props: {
                                data: data,
                                freqType: freqType
                            }
                        });
                    },
                    (err) => {
                        dispatch({
                            actionType: Actions.FETCH_INFO_DONE,
                            props: {
                                data: Immutable.List<ProviderWordMatch>()
                            },
                            error: err
                        });
                    }
                );
            }
            break;
        }
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
    private mergeDataOfProviders(state:KwicConnectState, newData:Immutable.List<ProviderWordMatch>):void {
        if (state.data.size > 0) {
            state.data = state.data.map((providerData, i) => {
                return {
                    heading: providerData.heading,
                    note: providerData.note,
                    renderer: providerData.renderer,
                    data: providerData.data.concat(newData.get(i).data).toList()
                }
            }).toList();

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

    private fetchKwicInfo(state:KwicConnectState, items:Array<string>):RSVP.Promise<Immutable.List<ProviderWordMatch>> {
        const args = new MultiDict();
        args.set('corpname', state.mainCorp);
        args.replace('align', state.corpora.filter(v => v !== state.mainCorp).toArray());
        items.slice(0, 10).forEach(v => args.add('w', v));
        return this.pluginApi.ajax<AjaxResponseFetchData>(
            'GET',
            this.pluginApi.createActionUrl('fetch_external_kwic_info'),
            args

        ).then(
            (responseData) => {
                return Immutable.List<ProviderWordMatch>(responseData.data.map(provider => {
                    return {
                        data: Immutable.List<ProviderOutput>(provider.data.map(item => {
                            return {
                                contents: item.contents,
                                found: item.status,
                                kwic: item.kwic
                            };
                        })),
                        heading: provider.heading,
                        note: provider.note,
                        renderer: this.rendererMap(provider.renderer)
                    };
                }));
            }
        );
    }

    private fetchUniqValues(fDistType:FreqDistType):RSVP.Promise<Array<string>> {
        const args = this.pluginApi.getConcArgs();
        args.set('fcrit', `${fDistType}/ie 0~0>0`);
        args.set('ml', 0);
        args.set('flimit', this.concLinesProvider.getRecommOverviewMinFreq());
        args.set('freq_sort', 'freq');
        args.set('pagesize', 10);
        args.set('format', 'json');
        return this.pluginApi.ajax<TTDistResponse.FreqData>(
            'GET',
            this.pluginApi.createActionUrl('freqs'),
            args
        ).then(
            (data) => {
                return data.Blocks[0].Items.map(item => {
                    return item.Word.map(w => w.n.replace(/\s+/, ' ')).join(' ');
                });
            }
        );
    }

}