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

import { Kontext } from '../../types/common';
import { Actions, ActionName } from './actions';
import { Actions as QueryActions, ActionName as QueryActionName } from '../query/actions';
import { Actions as GlobalActions, ActionName as GlobalActionName } from '../common/actions';
import { forkJoin } from 'rxjs';
import { scan, tap } from 'rxjs/operators';
import { AjaxResponse } from '../../types/ajaxResponses';
import { MultiDict } from '../../multidict';
import { IUnregistrable } from './common';


interface UnregistrationGroup {
    models:Array<IUnregistrable>;
    onDone:()=>void;
}

export interface CorpusSwitchModelState {
    prevCorpora:Array<string>;
    isBusy:boolean;
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
                prevCorpora: List.concat(
                    conf.getConf<Array<string>>('alignedCorpora'),
                    [conf.getConf<Kontext.FullCorpusIdent>('corpusIdent').id]
                )
            }
        );
        this.appNavig = appNavig;
        this._dispatcher = dispatcher;
        this.conf = conf;
        this.history = history;
        this.registrations = [];

        this.addActionHandler<QueryActions.QueryInputAddAlignedCorpus>(
            QueryActionName.QueryInputAddAlignedCorpus,
            action => {
                const currAligned = this.conf.getConf<Array<string>>('alignedCorpora');
                List.addUnique(action.payload.corpname, [...currAligned]);
                this.conf.setConf('alignedCorpora', currAligned);

                this.changeState(state => {
                    state.prevCorpora.push(action.payload.corpname);
                });
            }
        );

        this.addActionHandler<QueryActions.QueryInputRemoveAlignedCorpus>(
            QueryActionName.QueryInputRemoveAlignedCorpus,
            action => {
                const currAligned = this.conf.getConf<Array<string>>('alignedCorpora');
                const srchIdx = List.findIndex(v => v === action.payload.corpname, currAligned);
                if (srchIdx > -1) {
                    this.conf.setConf('alignedCorpora', List.removeAt(srchIdx, currAligned));
                }
                this.changeState(state => {
                    const srchIdx = List.findIndex(v => v === action.payload.corpname, state.prevCorpora);
                    if (srchIdx > -1) {
                        List.removeAt(srchIdx, state.prevCorpora);
                    }
                });
            }
        );

        this.addActionHandler<Actions.SwitchCorpus>(
            ActionName.SwitchCorpus,
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
                            if (wAction.name === ActionName.SwitchCorpusReady) {
                                syncData[(wAction as Actions.SwitchCorpusReady<{}>).payload.modelId] = true;
                                return Dict.hasValue(false, syncData) ? {...syncData} : null;
                            }
                            return syncData;
                        }
                    ).pipe(
                        scan(
                            (acc, action:Actions.SwitchCorpusReady<{}>) => {
                                acc[action.payload.modelId] = action.payload.data;
                                return acc;
                            },
                            {}
                        )
                    ),
                    this.appNavig.ajax$<AjaxResponse.CorpusSwitchResponse>(
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
                            const args = new MultiDict();
                            args.set('corpname', data.corpusIdent.id);
                            args.set('usesubcorp', data.corpusIdent.usesubcorp);
                            this.history.pushState(this.conf.getConf<string>('currentAction'), args);

                            this.conf.setConf<Kontext.FullCorpusIdent>('corpusIdent', data.corpusIdent);
                            this.conf.setConf<string>('baseAttr', data.baseAttr);
                            this.conf.setConf<Array<[string, string]>>('currentArgs', data.currentArgs);
                            this.conf.setConf<Array<string>>('compiledQuery', data.compiledQuery);
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
                        }
                    )

                ).subscribe(
                    ([storedStates,]) => {
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
                        this._dispatcher.dispatch<Actions.CorpusSwitchModelRestore>({
                            name: ActionName.CorpusSwitchModelRestore,
                            payload: {
                                data: storedStates,
                                corpora: List.zip(action.payload.corpora, prevCorpora),
                                changePrimaryCorpus: action.payload.changePrimaryCorpus
                            }
                        });
                    },
                    err => {
                        this.changeState(state => {
                            state.isBusy = false;
                        });
                        this._dispatcher.dispatch<GlobalActions.MessageAdd>({
                            name: GlobalActionName.MessageAdd,
                            payload: {
                                messageType: 'error',
                                message: err
                            }
                        });
                        this._dispatcher.dispatch<Actions.CorpusSwitchModelRestore>({
                            name: ActionName.CorpusSwitchModelRestore,
                            error: err
                        });
                    }
                )
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
