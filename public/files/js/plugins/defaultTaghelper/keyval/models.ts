/*
 * Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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

import { tuple, pipe, List, Dict, HTTP } from 'cnc-tskit';
import { Action, StatefulModel, IFullActionControl } from 'kombo';

import * as PluginInterfaces from '../../../types/plugins';
import { TagBuilderBaseState } from '../common';
import { Actions } from '../actions';
import * as Kontext from '../../../types/kontext';
import { Actions as QueryActions } from '../../../models/query/actions';
import { IPluginApi } from '../../../types/plugins/common';


interface DataResponse extends Kontext.AjaxResponse {
    keyval_tags:{[key:string]:Array<string>};
}

export class FilterRecord {

    readonly name:string;

    readonly value:string;

    constructor(name:string, value:string) {
        this.name = name;
        this.value = value;
    }

    composeString():string {
        return `${this.name}=${this.value}`;
    }

    getKeyval():[string, string] {
        return tuple(this.name, this.value);
    }

    compare(that:FilterRecord):number {
        return this.composeString() < that.composeString() ? -1 : 1;
    }

    equals(rec2:FilterRecord):boolean {
        return this.name === rec2.name && this.value === rec2.value;
    }

    setValue(v:string):FilterRecord {
        return new FilterRecord(this.name, v);
    }
}

function composeQuery(data:TagsetStatus):string {
    return pipe(
        data.filterFeaturesHistory,
        List.last(),
        List.groupBy(x => x.name),
        List.map(
            ([recName, groupedRecs]) =>
                recName === 'POS' ?
                    `${data.posField}="${groupedRecs.map(x => x.value).join('|')}"` :
                    `${data.featureField}="${groupedRecs.map(x => x.composeString()).join('|')}"`
        ),
        List.sorted((v1, v2) => v1.localeCompare(v2))
    ).join(' & ');
}


export interface TagsetStatus {

    corpname:string;

    /**
     * An encoded representation of a tag selection. From CQL
     * point of view, this is just a string. Typically,
     * this can be used directly as a part of 'generatedQuery'.
     *
     * The value is used when user directly modifies an
     * existing tag within a CQL query. In such case, we
     * inject just the raw value.
     */
    rawPattern:string;

    canUndo:boolean;

    // a string-exported variant of the current UD props selection
    generatedQuery:string;

    error:Error|null;

    allFeatures:{[key:string]:Array<string>};

    availableFeatures:{[key:string]:Array<string>};

    filterFeaturesHistory:Array<Array<FilterRecord>>;

    showCategory:string;

    posField:string;

    featureField:string;

    // where in the current CQL query the resulting
    // expression will by inserted
    queryRange:[number, number];
}


export function createEmptyUDTagsetStatus(tagsetInfo:PluginInterfaces.TagHelper.TagsetInfo, corpname:string):TagsetStatus {
    return {
        corpname,
        canUndo: false,
        generatedQuery: '',
        rawPattern: '', // not applicable for the current UI
        error: null,
        allFeatures: {},
        availableFeatures: {'': []},
        filterFeaturesHistory: [[]],
        showCategory: '',
        posField: tagsetInfo.posAttr,
        featureField: tagsetInfo.featAttr,
        queryRange:[0, 0]
    };
}

export interface UDTagBuilderModelState extends TagBuilderBaseState {

    data:{[sourceId:string]:TagsetStatus};

}

export class UDTagBuilderModel extends StatefulModel<UDTagBuilderModelState> {

    private readonly pluginApi:IPluginApi;

    private readonly tagsetId:string;

    constructor(dispatcher:IFullActionControl, pluginApi:IPluginApi,
            initialState:UDTagBuilderModelState, tagsetId:string) {
        super(dispatcher, initialState);
        this.pluginApi = pluginApi;
        this.tagsetId = tagsetId;

        this.addActionSubtypeHandler<typeof Actions.KVSelectCategory>(
            Actions.KVSelectCategory.name,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                this.changeState(state => {
                    state.data[action.payload.sourceId].showCategory = action.payload.value;
                });
            }
        );

        this.addActionSubtypeHandler<typeof Actions.GetInitialData>(
            Actions.GetInitialData.name,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                    if (!Dict.hasKey(action.payload.sourceId, state.data)) {
                        state.data[action.payload.sourceId] = createEmptyUDTagsetStatus(
                                state.tagsetInfo, action.payload.corpname);
                    }
                });
                if (this.state.data[action.payload.sourceId].filterFeaturesHistory.length === 1) {
                    this.getFilteredFeatures<typeof Actions.KVGetInitialDataDone['payload']>(
                        (data, err) => err ?
                        {
                            name: Actions.KVGetInitialDataDone.name,
                            error: err

                        } :
                        {
                            name: Actions.KVGetInitialDataDone.name,
                            payload: {
                                tagsetId: this.tagsetId,
                                sourceId: action.payload.sourceId,
                                result: data
                            }
                        },
                        false,
                        action.payload.sourceId
                    );

                } else {
                    this.dispatchSideEffect<typeof Actions.KVGetInitialDataNOP>({
                        name: Actions.KVGetInitialDataNOP.name,
                        payload: {
                            tagsetId: action.payload.tagsetId
                        }
                    });
                }
            }
        );

        this.addActionSubtypeHandler<typeof Actions.KVGetInitialDataDone>(
            Actions.KVGetInitialDataDone.name,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                this.changeState(state => {
                    if (!action.error) {
                        state.data[action.payload.sourceId].availableFeatures = action.payload.result;
                        state.data[action.payload.sourceId].allFeatures = action.payload.result;
                        state.data[action.payload.sourceId].showCategory = pipe(
                            action.payload.result,
                            Dict.keys(),
                            List.sorted((v1, v2) => v1.localeCompare(v2)),
                            List.head()
                        );

                    } else {
                        state.data[action.payload.sourceId].error = action.error;
                    }
                    state.isBusy = false;
                });
            }
        );

        this.addActionSubtypeHandler<typeof Actions.KVGetInitialDataNOP>(
            Actions.KVGetInitialDataNOP.name,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                this.changeState(state => {
                    state.isBusy = false;
                });
            }
        );

        this.addActionSubtypeHandler<typeof Actions.KVGetFilteredDataDone>(
            Actions.KVGetFilteredDataDone.name,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                this.changeState(state => {
                    if (action.error) {
                        state.data[action.payload.sourceId].error = action.error;

                    } else {
                        const reset = Dict.map(
                            _ => [],
                            state.data[action.payload.sourceId].availableFeatures
                        )
                        state.data[action.payload.sourceId].availableFeatures = {
                            ...reset, ...action.payload.result};
                    }
                    state.isBusy = false;
                });
            }
        );

        this.addActionSubtypeHandler<typeof Actions.KVAddFilter>(
            Actions.KVAddFilter.name,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                this.changeState(state => {
                    const filter = new FilterRecord(
                        action.payload.name,
                        action.payload.value
                    );
                    const filterFeatures = List.last(state.data[action.payload.sourceId].filterFeaturesHistory);
                    state.isBusy = true;
                    if (List.every(x => !x.equals(filter), filterFeatures)) {
                        filterFeatures.push(filter);
                        state.data[action.payload.sourceId].filterFeaturesHistory.push(filterFeatures);
                        state.data[action.payload.sourceId].canUndo = true;
                        state.data[action.payload.sourceId].generatedQuery = composeQuery(
                            state.data[action.payload.sourceId]);
                    }
                });
                this.updateFeatures(action.payload.sourceId);
            }
        );

        this.addActionSubtypeHandler<typeof Actions.KVRemoveFilter>(
            Actions.KVRemoveFilter.name,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                const filter = new FilterRecord(
                    action.payload.name,
                    action.payload.value
                );
                this.changeState(state => {
                    const filterFeatures = List.last(state.data[action.payload.sourceId].filterFeaturesHistory);

                    const newFilterFeatures = List.filter(
                        value => !value.equals(filter),
                        filterFeatures
                    );
                    state.data[action.payload.sourceId].filterFeaturesHistory.push(newFilterFeatures);
                    state.data[action.payload.sourceId].canUndo = true;
                    state.isBusy = true;
                    state.data[action.payload.sourceId].generatedQuery = composeQuery(state.data[action.payload.sourceId]);
                });
                this.updateFeatures(action.payload.sourceId);
            }
        );

        this.addActionSubtypeHandler<typeof Actions.Undo>(
            Actions.Undo.name,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                this.changeState(state => {
                    const data = state.data[action.payload.sourceId];
                    data.filterFeaturesHistory = List.init(data.filterFeaturesHistory);
                    if (data.filterFeaturesHistory.length === 1) {
                        data.canUndo = false;
                    }
                    state.isBusy = true;
                    data.generatedQuery = composeQuery(data);
                });
                this.updateFeatures(action.payload.sourceId);
            }
        );

        this.addActionSubtypeHandler<typeof Actions.Reset>(
            Actions.Reset.name,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                this.changeState(state => {
                    const data = state.data[action.payload.sourceId];
                    data.filterFeaturesHistory = [[]];
                    data.availableFeatures = data.allFeatures;
                    data.canUndo = false;
                    data.generatedQuery = composeQuery(data);
                });
            }
        );

        this.addActionSubtypeHandler<typeof Actions.SetActiveTag>(
            Actions.SetActiveTag.name,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                    if (!Dict.hasKey(action.payload.sourceId, state.data)) {
                        state.data[action.payload.sourceId] = createEmptyUDTagsetStatus(
                                state.tagsetInfo, action.payload.corpname);
                    }
                });
                if (this.state.data[action.payload.sourceId].filterFeaturesHistory.length === 1) {
                    this.getFilteredFeatures<typeof Actions.KVGetInitialDataDone['payload']>(
                        (data, err) => err ?
                        {
                            name: Actions.KVGetInitialDataDone.name,
                            error: err

                        } :
                        {
                            name: Actions.KVGetInitialDataDone.name,
                            payload: {
                                tagsetId: this.tagsetId,
                                sourceId: action.payload.sourceId,
                                result: data
                            }
                        },
                        false,
                        action.payload.sourceId
                    );

                } else {
                    this.dispatchSideEffect<typeof Actions.KVGetInitialDataNOP>({
                        name: Actions.KVGetInitialDataNOP.name,
                        payload: {
                            tagsetId: action.payload.tagsetId
                        }
                    });
                }
            }
        );

        this.addActionHandler<typeof QueryActions.SetActiveInputWidget>(
            QueryActions.SetActiveInputWidget.name,
            action => {
                this.changeState(state => {
                    if (!Dict.hasKey(action.payload.sourceId, state.data)) {
                        state.data[action.payload.sourceId] = createEmptyUDTagsetStatus(
                                state.tagsetInfo, action.payload.corpname);
                    }
                    state.data[action.payload.sourceId].queryRange = action.payload.appliedQueryRange;
                });
            }
        );
    }


    private getFilteredFeatures<U>(
        actionFactory:(data:any, err?:Error)=>Action<U>,
        useFilter:boolean,
        sourceId:string
    ) {
        const baseArgs:Array<[string, string]> = [
            tuple('corpname', this.state.data[sourceId].corpname),
            tuple('tagset', this.state.tagsetInfo.ident)
        ];
        const queryArgs:Array<[string, string]> = pipe(
            this.state.data[sourceId].filterFeaturesHistory,
            List.last(),
            List.map(x => x.getKeyval())
        );

        this.pluginApi.ajax$<DataResponse>(
            HTTP.Method.GET,
            this.pluginApi.createActionUrl(
                'corpora/ajax_get_tag_variants',
                useFilter ? baseArgs.concat(queryArgs) : baseArgs
            ),
            {}

        ).subscribe(
            (result) => {
                this.dispatchSideEffect<Action<U>>(actionFactory(result.keyval_tags));
            },
            (error) => {
                this.dispatchSideEffect(actionFactory(null, error));
            }
        );
    }

    private updateFeatures(sourceId:string):void {
        this.getFilteredFeatures<typeof Actions.KVGetFilteredDataDone['payload']>(
            (data, err) => err ?
                {
                    name: Actions.KVGetFilteredDataDone.name,
                    error: err

                } :
                {
                    name: Actions.KVGetFilteredDataDone.name,
                    payload: {
                        tagsetId: this.tagsetId,
                        sourceId,
                        result: data
                    }
                },
            true,
            sourceId
        );
    }

}
