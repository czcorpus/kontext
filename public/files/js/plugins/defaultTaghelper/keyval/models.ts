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
import { StatelessModel, IActionDispatcher, Action, SEDispatcher } from 'kombo';

import { IPluginApi } from '../../../types/plugins';
import { TagBuilderBaseState } from '../common';
import { Actions, ActionName } from '../actions';
import { Kontext } from '../../../types/common';


export interface FeatureSelectProps {
    sourceId:string;
    error:Error|null;
    allFeatures:{[key:string]:Array<string>};
    availableFeatures:{[key:string]:Array<string>};
    filterFeaturesHistory:Array<Array<FilterRecord>>;
    showCategory:string;
}

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

function composeQuery(state:UDTagBuilderModelState):string {
    return pipe(
        state.filterFeaturesHistory,
        List.last(),
        List.groupBy(x => x.name),
        List.map(
            ([recName, groupedRecs]) =>
                recName === 'POS' ?
                    `${state.posField}="${groupedRecs.map(x => x.value).join('|')}"` :
                    `${state.featureField}="${groupedRecs.map(x => x.composeString()).join('|')}"`
        ),
        List.sorted((v1, v2) => v1.localeCompare(v2))
    ).join(' & ');
}

export interface UDTagBuilderModelState extends TagBuilderBaseState {

    // where in the current CQL query the resulting
    // expression will by inserted
    insertRange:[number, number];

    canUndo:boolean;

    // a string-exported variant of the current UD props selection
    generatedQuery:string;


    // ...
    error: Error|null;
    allFeatures:{[key:string]:Array<string>};
    availableFeatures:{[key:string]:Array<string>};
    filterFeaturesHistory:Array<Array<FilterRecord>>;
    showCategory:string;

    posField: string;
    featureField: string;
}

export class UDTagBuilderModel extends StatelessModel<UDTagBuilderModelState> {

    private readonly pluginApi:IPluginApi;

    private readonly ident:string;

    private readonly sourceId:string;

    constructor(dispatcher:IActionDispatcher, pluginApi:IPluginApi,
            initialState:UDTagBuilderModelState, ident:string) {
        super(dispatcher, initialState);
        this.pluginApi = pluginApi;
        this.ident = ident;
        this.sourceId = initialState.corpname;

        this.addActionSubtypeHandler<Actions.KVSelectCategory>(
            ActionName.KVSelectCategory,
            action => action.payload.sourceId === this.sourceId,
            (state, action) => {
                state.showCategory = action.payload.value;
            }
        );

        this.addActionSubtypeHandler<Actions.GetInitialData>(
            ActionName.GetInitialData,
            action => action.payload.sourceId === this.sourceId,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                if (state.filterFeaturesHistory.length === 1) {
                    this.getFilteredFeatures(
                        state,
                        dispatch,
                        (data, err) => err ?
                        {
                            name: ActionName.KVGetInitialDataDone,
                            error: err

                        } :
                        {
                            name: ActionName.KVGetInitialDataDone,
                            payload: {
                                sourceId: this.sourceId,
                                result: data
                            }
                        },
                        false
                    );
                }
            }
        );

        this.addActionSubtypeHandler<Actions.KVGetInitialDataDone>(
            ActionName.KVGetInitialDataDone,
            action => action.payload.sourceId === this.sourceId,
            (state, action) => {
                if (!action.error) {
                    state.allFeatures = action.payload.result;
                    state.availableFeatures = state.allFeatures;
                    state.showCategory = pipe(
                        state.allFeatures,
                        Dict.keys(),
                        List.sorted((v1, v2) => v1.localeCompare(v2)),
                        List.head()
                    );

                } else {
                    state.error = action.error;
                }
                state.isBusy = false;
            }
        );

        this.addActionSubtypeHandler<Actions.KVGetFilteredDataDone>(
            ActionName.KVGetFilteredDataDone,
            action => action.payload.sourceId === this.sourceId,
            (state, action) => {
                if (action.error) {
                    state.error = action.error;

                } else {
                    const reset = Dict.map(
                        _ => [],
                        state.availableFeatures
                    )
                    state.availableFeatures = {...reset, ...action.payload.result};
                }
                state.isBusy = false;
            }
        );

        this.addActionSubtypeHandler<Actions.KVAddFilter>(
            ActionName.KVAddFilter,
            action => action.payload.sourceId === this.sourceId,
            (state, action) => {
                const filter = new FilterRecord(
                    action.payload.name,
                    action.payload.value
                );
                const filterFeatures = List.last(state.filterFeaturesHistory);
                state.isBusy = true;
                if (List.every(x => !x.equals(filter), filterFeatures)) {
                    filterFeatures.push(filter);
                    state.filterFeaturesHistory.push(filterFeatures);
                    state.canUndo = true;
                    state.generatedQuery = composeQuery(state);
                }
            },
            (state, action, dispatch) => {
                this.getFilteredFeatures(
                    state,
                    dispatch,
                    (data, err) => err ?
                        {
                            name: ActionName.KVGetFilteredDataDone,
                            error: err

                        } :
                        {
                            name: ActionName.KVGetFilteredDataDone,
                            payload: {
                                sourceId: this.sourceId,
                                result: data
                            }
                        },
                    true
                );
            }
        ).sideEffectAlsoOn(
            ActionName.KVRemoveFilter,
            ActionName.Undo
        );

        this.addActionSubtypeHandler<Actions.KVRemoveFilter>(
            ActionName.KVRemoveFilter,
            action => action.payload.sourceId === this.sourceId,
            (state, action) => {
                const filter = new FilterRecord(
                    action.payload.name,
                    action.payload.value
                );
                const filterFeatures = List.last(state.filterFeaturesHistory);

                const newFilterFeatures = List.filter(
                    value => !value.equals(filter),
                    filterFeatures
                );
                state.filterFeaturesHistory.push(newFilterFeatures);
                state.canUndo = true;
                state.isBusy = true;
                state.generatedQuery = composeQuery(state);
            }
        );

        this.addActionSubtypeHandler<Actions.Undo>(
            ActionName.Undo,
            action => action.payload.sourceId === this.sourceId,
            (state, action) => {
                state.filterFeaturesHistory = List.init(state.filterFeaturesHistory);
                if (state.filterFeaturesHistory.length === 1) {
                    state.canUndo = false;
                }
                state.isBusy = true;
                state.generatedQuery = composeQuery(state);
            }
        );

        this.addActionSubtypeHandler<Actions.Reset>(
            ActionName.Reset,
            action => action.payload.sourceId === this.sourceId,
            (state, action) => {
                state.filterFeaturesHistory = [[]];
                state.availableFeatures = state.allFeatures;
                state.canUndo = false;
                state.generatedQuery = composeQuery(state);
            }
        );

        this.addActionSubtypeHandler<Actions.SetActiveTag>(
            ActionName.SetActiveTag,
            action => action.payload.sourceId === this.sourceId,
            null,
            (state, action, dispatch) => {
                if (this.ident !== action.payload.value) {
                    this.suspend(
                        {},
                        (nextAction, syncObj) => this.ident === nextAction.payload['value'] ?
                            null : syncObj
                    ).subscribe(); // TODO is this correct?
                }
            }
        );
    }


    private getFilteredFeatures<U>(state:UDTagBuilderModelState, dispatch:SEDispatcher,
            actionFactory:(data:any, err?:Error)=>Action<U>, useFilter:boolean) {
        const baseArgs:Array<[string, string]> = [
            tuple('corpname', state.corpname),
            tuple('tagset', state.tagsetName)
        ];
        const queryArgs:Array<[string, string]> = pipe(
            state.filterFeaturesHistory,
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
                dispatch<Action<U>>(actionFactory(result.keyval_tags));
            },
            (error) => {
                dispatch(actionFactory(null, error));
            }
        )
    }

}
