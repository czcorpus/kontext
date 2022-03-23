/*
 * Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
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

import { StatefulModel, IFullActionControl } from 'kombo';
import { List, Dict, HTTP, pipe, tuple } from 'cnc-tskit';

import * as Kontext from '../../types/kontext';
import { Actions } from './actions';
import { Actions as QueryActions } from '../query/actions';
import { Actions as GlobalActions } from '../common/actions';
import { forkJoin } from 'rxjs';
import { scan, tap } from 'rxjs/operators';
import { IUnregistrable } from './common';
import { AjaxConcResponse } from '../concordance/common';


interface UnregistrationGroup {
    models:Array<IUnregistrable>;
    onDone:()=>void;
}

export interface CorpusSwitchModelState {
    prevCorpora:Array<string>;
    isBusy:boolean;
}

export interface CorpusSwitchResponse extends AjaxConcResponse {
    corpname:string; // deprecated
    humanCorpname:string; // deprecated
    corpusIdent:Kontext.FullCorpusIdent;
    subcorpname:string;
    baseAttr:string;
    currentArgs:Array<[string, string]>;
    concPersistenceOpId:string;
    alignedCorpora:Array<string>;
    availableAlignedCorpora:Array<Kontext.AttrItem>;
    activePlugins:Array<string>;
    queryOverview:Array<Kontext.QueryOperation>;
    numQueryOps:number;
    textTypesData:any; // TODO type
    structsAndAttrs:Kontext.StructsAndAttrs;
    menuData:any; // TODO type
    Wposlist:Array<any>; // TODO type
    AttrList:Array<any>; // TODO type
    AlignCommonPosAttrs:Array<string>; // TODO type
    StructAttrList:Array<Kontext.AttrItem>;
    StructList:Array<string>;
    InputLanguages:{[corpname:string]:string};
    ConcFormsArgs:any; // TODO type
    CurrentSubcorp:string;
    SubcorpList:Array<{v:string; n:string}>;
    TextTypesNotes:string;
    TextDirectionRTL:boolean;
    // here it is impossible to determine a detailed type in a reasonable way
    pluginData:{[plgName:string]:any};
    DefaultVirtKeyboard:string;
    SimpleQueryDefaultAttrs:Array<string>;
    QSEnabled:boolean;
    ShuffleConcByDefault:number;
}


export class CorpusSwitchModel extends StatefulModel<CorpusSwitchModelState> {

    private readonly appNavig:Kontext.IURLHandler & Kontext.IAjaxHandler;

    private readonly conf:Kontext.IConfHandler;

    private readonly history:Kontext.IHistory;

    private readonly _dispatcher:IFullActionControl;

    private readonly registrations:Array<UnregistrationGroup>;

    constructor(
        appNavig:Kontext.IURLHandler & Kontext.IAjaxHandler,
        dispatcher:IFullActionControl,
        conf:Kontext.IConfHandler,
        history:Kontext.IHistory
    ) {
        super(
            dispatcher,
            {
                isBusy: false,
                prevCorpora: [...conf.getConf<Array<string>>('alignedCorpora'),
                              conf.getConf<Kontext.FullCorpusIdent>('corpusIdent').id]
            }
        );
        this.appNavig = appNavig;
        this._dispatcher = dispatcher;
        this.conf = conf;
        this.history = history;
        this.registrations = [];

        this.addActionHandler<typeof Actions.SwitchCorpus>(
            Actions.SwitchCorpus.name,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                });
                forkJoin([
                    this.suspendWithTimeout(
                        5000,
                        pipe(
                            this.allRegisteredIds(),
                            List.map(v => tuple(v, false)),
                            Dict.fromEntries()
                        ),
                        (wAction, syncData) => {
                            if (wAction.name === Actions.SwitchCorpusReady.name) {
                                syncData[(wAction as typeof Actions.SwitchCorpusReady).payload.modelId] = true;
                                return Dict.hasValue(false, syncData) ? {...syncData} : null;
                            }
                            return syncData;
                        }
                    ).pipe(
                        scan(
                            (acc, action) => {
                                if (Actions.isSwitchCorpusReady(action)) {
                                    acc[action.payload.modelId] = action.payload.data;
                                }
                                return acc;
                            },
                            {}
                        )
                    ),
                    this.appNavig.ajax$<CorpusSwitchResponse>(
                        HTTP.Method.POST,
                        this.appNavig.createActionUrl('ajax_switch_corpus'),
                        {
                            corpname: List.head(action.payload.corpora),
                            usesubcorp: action.payload.subcorpus,
                            align: List.tail(action.payload.corpora)
                        }
                    )

                ]).pipe(
                    tap(
                        ([,data]) => {
                            this.history.pushState(
                                this.conf.getConf<string>('currentAction'),
                                Dict.filter(
                                    v => !!v,
                                    {
                                        corpname: data.corpusIdent.id,
                                        usesubcorp: data.corpusIdent.usesubcorp,
                                        align: data.alignedCorpora
                                    }
                                )
                            );
                            this.conf.setConf<Kontext.FullCorpusIdent>('corpusIdent', data.corpusIdent);
                            this.conf.setConf<string>('baseAttr', data.baseAttr);
                            this.conf.setConf<Array<[string, string]>>('currentArgs', data.currentArgs);
                            this.conf.setConf<string>('concPersistenceOpId', data.concPersistenceOpId);
                            this.conf.setConf<Array<string>>('alignedCorpora', data.alignedCorpora);
                            this.conf.setConf<Array<Kontext.AttrItem>>('availableAlignedCorpora', data.availableAlignedCorpora);
                            this.conf.setConf<Array<string>>('activePlugins', data.activePlugins);
                            this.conf.setConf<Array<Kontext.QueryOperation>>('queryOverview', data.queryOverview);
                            this.conf.setConf<number>('numQueryOps', data.numQueryOps);
                            this.conf.setConf<any>('textTypesData', data.textTypesData); // TODO type
                            this.conf.setConf<Kontext.StructsAndAttrs>('structsAndAttrs', data.structsAndAttrs);
                            this.conf.setConf<any>('menuData', data.menuData); // TODO type
                            this.conf.setConf<Array<any>>('Wposlist', data.Wposlist); // TODO type
                            this.conf.setConf<Array<any>>('AttrList', data.AttrList); // TODO type
                            this.conf.setConf<Array<string>>('AlignCommonPosAttrs', data.AlignCommonPosAttrs);
                            this.conf.setConf<Array<Kontext.AttrItem>>('StructAttrList', data.StructAttrList);
                            this.conf.setConf<Array<string>>('StructList', data.StructList);
                            this.conf.setConf<{[corpname:string]:string}>('InputLanguages', data.InputLanguages);
                            this.conf.setConf<any>('ConcFormsArgs', data.ConcFormsArgs); // TODO type
                            this.conf.setConf<string>('CurrentSubcorp', data.CurrentSubcorp);
                            this.conf.setConf<Array<{v:string; n:string}>>('SubcorpList', data.SubcorpList);
                            this.conf.setConf<string>('TextTypesNotes', data.TextTypesNotes);
                            this.conf.setConf<boolean>('TextDirectionRTL', data.TextDirectionRTL);
                            this.conf.setConf<{[plgName:string]:any}>('pluginData', data.pluginData);
                            this.conf.setConf<string>('DefaultVirtKeyboard', data.DefaultVirtKeyboard);
                            this.conf.setConf<Array<string>>('SimpleQueryDefaultAttrs', data.SimpleQueryDefaultAttrs);
                            this.conf.setConf<boolean>('QSEnabled', data.QSEnabled);
                            this.conf.setConf<number>('ShuffleConcByDefault', data.ShuffleConcByDefault);
                        }
                    )

                ).subscribe({
                    next: ([storedStates,]) => {
                        List.forEach(
                            group => {
                                List.forEach(
                                    item => item.unregister(),
                                    group.models
                                );
                                group.onDone();
                            },
                            this.registrations.splice(0)
                        );
                        const prevCorpora = this.state.prevCorpora;
                        this.changeState(state => {
                            state.prevCorpora = action.payload.corpora;
                            state.isBusy = false;
                        });
                        this._dispatcher.dispatch<typeof Actions.CorpusSwitchModelRestore>({
                            name: Actions.CorpusSwitchModelRestore.name,
                            payload: {
                                data: storedStates,
                                corpora: List.zipAll(action.payload.corpora, prevCorpora),
                                newPrimaryCorpus: action.payload.newPrimaryCorpus
                            }
                        });
                    },
                    error: error => {
                        this.changeState(state => {
                            state.isBusy = false;
                        });
                        this._dispatcher.dispatch<typeof GlobalActions.MessageAdd>({
                            name: GlobalActions.MessageAdd.name,
                            payload: {
                                messageType: 'error',
                                message: error
                            }
                        });
                        this._dispatcher.dispatch<typeof Actions.CorpusSwitchModelRestore>({
                            name: Actions.CorpusSwitchModelRestore.name,
                            error
                        });
                    }
                });
            }
        );

        this.addActionHandler<typeof QueryActions.QueryInputSelectSubcorp>(
            QueryActions.QueryInputSelectSubcorp.name,
            action => {
                this.history.pushState(
                    this.conf.getConf<string>('currentAction'),
                    Dict.filter(
                        v => !!v,
                        {
                            corpname: action.payload.corpusName,
                            usesubcorp: action.payload.subcorp
                        }
                    )
                );
            }
        );
    }

    private allRegisteredIds():Array<string> {
        return pipe(
            this.registrations,
            List.flatMap(group => group.models),
            List.map(model => model.getRegistrationId())
        );
    }

    registerModels(onDone:()=>void, ...models:Array<IUnregistrable>):void {
        this.registrations.push({
            onDone: onDone,
            models: models
        });
    }
}
