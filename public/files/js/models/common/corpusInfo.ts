/*
 * Copyright (c) 2015 Charles University, Faculty of Arts,
 *                    Department of Linguistics
 * Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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

import { Observable, of as rxOf, EMPTY } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { HTTP } from 'cnc-tskit';
import { StatefulModel, IFullActionControl } from 'kombo';

import { Actions } from './actions.js';
import { IPluginApi } from '../../types/plugins/common.js';
import {
    SubcorpusPropertiesResponse, SubcorpusRecord, subcServerRecord2SubcorpusRecord
} from '../subcorp/common.js';
import { TagsetInfo } from '../../types/plugins/tagHelper.js';



export interface CitationInfoResponse {
    default_ref:string;
    article_ref:Array<string>;
    other_bibliography:string;
}

export interface CitationInfo extends CitationInfoResponse {
    corpname:string;
    type:CorpusInfoType.CITATION;
}

export interface KeyShortcutsInfo {
    type:CorpusInfoType.KEY_SHORTCUTS;
}


export interface CorpusInfoResponse {
    corpname:string;
    description:string;
    size:number;
    attrlist:Array<{name:string; size:number}>;
    structlist:Array<{name:string; size:number}>;
    webUrl:string;
    citationInfo:CitationInfo;
    keywords:Array<{name:string; color:string}>;
    tagsets:Array<TagsetInfo>;
}

export interface CorpusInfo extends CorpusInfoResponse {
    type:CorpusInfoType.CORPUS;
}

export enum CorpusInfoType {
    CORPUS = 'corpus-info',
    CITATION = 'citation-info',
    SUBCORPUS = 'subcorpus-info',
    KEY_SHORTCUTS = 'keyboard-shortcuts'
}

export interface SubcorpusInfo extends SubcorpusRecord {
    type:CorpusInfoType.SUBCORPUS;
}

export type AnyOverviewInfo = CorpusInfo|SubcorpusInfo|CitationInfo|KeyShortcutsInfo;



/**
 *
 */
export interface CorpusInfoModelState {
    corpusData:CorpusInfoResponse;
    subcorpusData:SubcorpusRecord;
    currentCorpus:string;
    currentSubcorpus:string;
    currentInfoType:CorpusInfoType;
    isWaiting:boolean;
}

export class CorpusInfoModel extends StatefulModel<CorpusInfoModelState> {

    private readonly pluginApi:IPluginApi;

    constructor(dispatcher:IFullActionControl, pluginApi:IPluginApi) {
        super(
            dispatcher,
            {
                corpusData: null,
                subcorpusData: null,
                currentCorpus: null,
                currentSubcorpus: null,
                currentInfoType: null,
                isWaiting: false
            }
        );
        this.pluginApi = pluginApi;

        this.addActionHandler<typeof Actions.OverviewClose>(
            Actions.OverviewClose.name,
            action => {
                this.changeState(state => {state.currentInfoType = null})
            }
        );

        this.addActionHandler<typeof Actions.OverviewCorpusInfoRequired>(
            Actions.OverviewCorpusInfoRequired.name,
            action => {
                this.changeState(state => {state.isWaiting = true})
                this.emitChange();
                this.loadCorpusInfo(action.payload.corpusId).subscribe({
                    next: next => {
                        this.changeState(state => {
                            state.currentCorpus = action.payload.corpusId;
                            state.currentInfoType = CorpusInfoType.CORPUS;
                            state.isWaiting = false;
                        });
                    },
                    error: err => {
                        this.changeState(state => {state.isWaiting = false});
                        this.pluginApi.showMessage('error', err);
                    },
                });
            }
        );

        this.addActionHandler<typeof Actions.OverviewShowActionCitationInfo>(
            Actions.OverviewShowActionCitationInfo.name,
            action => {
                this.changeState(
                    state => {
                        state.isWaiting = true;
                    }
                );
                this.loadCorpusInfo(action.payload.corpusId).subscribe({
                    error: err => {
                        this.changeState(state => {state.isWaiting = false});
                        this.emitChange();
                        this.pluginApi.showMessage('error', err);
                    },
                    complete: () => {
                        this.changeState(state => {
                            state.currentCorpus = action.payload.corpusId;
                            state.currentInfoType = CorpusInfoType.CITATION;
                            state.isWaiting = false;
                        });
                    },
                });
            }
        );

        this.addActionHandler<typeof Actions.OverviewShowSubcorpusInfo>(
            Actions.OverviewShowSubcorpusInfo.name,
            action => {
                this.changeState(state => {state.isWaiting = true})
                this.loadSubcorpusInfo(
                    action.payload.corpusId,
                    action.payload.subcorpusId

                ).subscribe({
                    error: err => {
                        this.changeState(state => {state.isWaiting = false});
                        this.pluginApi.showMessage('error', err);
                    },
                    complete: () => {
                        this.changeState(state => {
                            state.currentCorpus = action.payload.corpusId;
                            state.currentSubcorpus = action.payload.subcorpusId;
                            state.currentInfoType = CorpusInfoType.SUBCORPUS;
                            state.isWaiting = false;
                        });
                    }
                });
            }
        );

        this.addActionHandler<typeof Actions.OverviewShowKeyShortcuts>(
            Actions.OverviewShowKeyShortcuts.name,
            action => {
                this.changeState(state => {
                    state.currentInfoType = CorpusInfoType.KEY_SHORTCUTS
                });
            }
        );
    }

    private loadCorpusInfo(corpusId:string):Observable<any> {
        if (this.state.corpusData && this.state.currentCorpus === corpusId) {
            return rxOf(this.state.corpusData);

        } else {
            return this.pluginApi.ajax$<CorpusInfoResponse>(
                HTTP.Method.GET,
                this.pluginApi.createActionUrl('corpora/ajax_get_corp_details'),
                {
                    corpname: this.pluginApi.getCorpusIdent().id
                }
            ).pipe(
                concatMap(
                    (data) => {
                        this.changeState(state => {
                            state.corpusData = data;
                            state.currentCorpus = corpusId;
                        })
                        return rxOf(data);
                    }
                )
            );
        }
    }

    private loadSubcorpusInfo(corpusId:string, subcorpusId:string):Observable<any> {

        const prom = corpusId !== this.state.currentCorpus ?
            this.loadCorpusInfo(corpusId) :
            rxOf(this.state.corpusData);

        if (this.state.subcorpusData && this.state.currentSubcorpus === subcorpusId) {
            return prom.pipe(concatMap((_) => rxOf(this.state.subcorpusData)));

        } else {
            return prom.pipe(
                concatMap(
                    (data) => {
                        return this.pluginApi.ajax$<SubcorpusPropertiesResponse>(
                            HTTP.Method.GET,
                            this.pluginApi.createActionUrl('subcorpus/properties'),
                            {
                                'corpname': corpusId,
                                'usesubcorp': subcorpusId
                            }
                        ).pipe(
                            concatMap(
                                (data) => {
                                    this.changeState(state => {
                                        state.subcorpusData = subcServerRecord2SubcorpusRecord(data.data);
                                        state.currentCorpus = corpusId;
                                        state.currentSubcorpus = subcorpusId;
                                    })
                                    return EMPTY;
                                }
                            )
                        );
                    }
                )
            );
        }
    }

    getCurrentInfoType():CorpusInfoType {
        return this.state.currentInfoType;
    }

    getCurrentInfoData():AnyOverviewInfo {
        switch (this.state.currentInfoType) {
            case CorpusInfoType.CORPUS:
                return {...this.state.corpusData, type:CorpusInfoType.CORPUS};
            case CorpusInfoType.CITATION:
                return {
                    ...this.state.corpusData.citationInfo,
                    corpname: this.state.currentCorpus,
                    type: CorpusInfoType.CITATION
                };
            case CorpusInfoType.SUBCORPUS:
                return {...this.state.subcorpusData, type:CorpusInfoType.SUBCORPUS};
            case CorpusInfoType.KEY_SHORTCUTS:
                return {type:CorpusInfoType.KEY_SHORTCUTS};
            default:
                return null;
        }
    }

    isLoading():boolean {
        return this.state.isWaiting;
    }
}