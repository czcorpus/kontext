/*
 * Copyright (c) 2016 Institute of the Czech National Corpus
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

import {IPluginApi} from '../../../types/plugins';
import { StatelessModel, IActionDispatcher, Action, SEDispatcher } from 'kombo';
import { TagBuilderBaseState } from '../common';
import { tuple, pipe, List, Dict, HTTP } from 'cnc-tskit';


export interface FeatureSelectProps {
    sourceId:string;
    error:Error|null;
    allFeatures:{[key:string]:Array<string>};
    availableFeatures:{[key:string]:Array<string>};
    filterFeaturesHistory:Array<Array<FilterRecord>>;
    showCategory:string;
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
        this.actionMatch = {
            'TAGHELPER_SELECT_CATEGORY': (state, action) => {
                if (action.payload['sourceId'] === this.sourceId) {
                    const newState = this.copyState(state);
                    newState.showCategory = action.payload['value'];
                    return newState;
                }
                return state;
            },
            'TAGHELPER_GET_INITIAL_DATA': (state, action) => {
                if (action.payload['sourceId'] === this.sourceId) {
                    const newState = this.copyState(state);
                    newState.isBusy = true;
                    return newState;
                }
            },
            'TAGHELPER_GET_INITIAL_DATA_DONE': (state, action) => {
                if (action.payload['sourceId'] === this.sourceId) {
                    const newState = this.copyState(state);
                    if (!action.error) {
                        newState.allFeatures = action.payload['result']; // TODO test and type !!!
                        newState.availableFeatures = newState.allFeatures;
                        newState.showCategory = pipe(
                            newState.allFeatures,
                            Dict.keys(),
                            List.sorted((v1, v2) => v1.localeCompare(v2)),
                            List.head()
                        )
                    } else {
                        newState.error = action.error;
                    }
                    newState.isBusy = false;
                    return newState;
                }
                return state;
            },
            'TAGHELPER_GET_FILTERED_DATA_DONE': (state, action) => {
                if (action.payload['sourceId'] === this.sourceId) {
                    const newState = this.copyState(state);
                    if (!action.error) {
                        newState.availableFeatures = action.payload['result']; // TODO test and type
                    } else {
                        newState.error = action.error;
                    }
                    newState.isBusy = false;
                    return newState;
                }
                return state;
            },
            'TAGHELPER_ADD_FILTER': (state, action) => {
                if (action.payload['sourceId'] === this.sourceId) {
                    const newState = this.copyState(state);
                    const filter = new FilterRecord(
                        action.payload['name'],
                        action.payload['value']
                    );
                    const filterFeatures = List.last(newState.filterFeaturesHistory);
                    newState.isBusy = true;
                    if (filterFeatures.every(x => !x.equals(filter))) {
                        filterFeatures.push(filter);
                        newState.filterFeaturesHistory.push(filterFeatures);
                        newState.canUndo = true;
                        newState.generatedQuery = composeQuery(newState);
                    }
                    return newState;
                }
                return state;
            },
            'TAGHELPER_REMOVE_FILTER': (state, action) => {
                if (action.payload['sourceId'] === this.sourceId) {
                    const newState = this.copyState(state);
                    const filter = new FilterRecord(
                        action.payload['name'],
                        action.payload['value']
                    );
                    const filterFeatures = List.last(newState.filterFeaturesHistory);

                    const newFilterFeatures = List.filter(
                        value => !value.equals(filter),
                        filterFeatures
                    );
                    newState.filterFeaturesHistory.push(newFilterFeatures);
                    newState.canUndo = true;
                    newState.isBusy = true;
                    newState.generatedQuery = composeQuery(newState);

                    return newState;
                }
                return state;
            },
            'TAGHELPER_UNDO': (state, action) => {
                if (action.payload['sourceId'] === this.sourceId) {
                    const newState = this.copyState(state);
                    newState.filterFeaturesHistory = List.init(newState.filterFeaturesHistory);
                    if (newState.filterFeaturesHistory.length === 1) {
                        newState.canUndo = false;
                    }
                    newState.isBusy = true;
                    newState.generatedQuery = composeQuery(newState);
                    return newState;
                }
                return state;
            },
            'TAGHELPER_RESET': (state, action) => {
                if (action.payload['sourceId'] === this.sourceId) {
                    const newState = this.copyState(state);
                    newState.filterFeaturesHistory = [[]];
                    newState.availableFeatures = newState.allFeatures;
                    newState.canUndo = false;
                    newState.generatedQuery = composeQuery(newState);
                    return newState;
                }
            }
        };
    }

    sideEffects(state:UDTagBuilderModelState, action:Action, dispatch:SEDispatcher) {
        switch (action.name) {
            case 'TAGHELPER_GET_INITIAL_DATA':
                if (action.payload['sourceId'] === this.sourceId &&
                        state.filterFeaturesHistory.length === 1) {
                    this.getFilteredFeatures(
                        state,
                        dispatch,
                        'TAGHELPER_GET_INITIAL_DATA_DONE',
                        false
                    );
                }
            break;

            case 'TAGHELPER_ADD_FILTER':
            case 'TAGHELPER_REMOVE_FILTER':
            case 'TAGHELPER_UNDO':
                if (action.payload['sourceId'] === this.sourceId) {
                    this.getFilteredFeatures(
                        state,
                        dispatch,
                        'TAGHELPER_GET_FILTERED_DATA_DONE',
                        true
                    );
                }
            break;
            case 'TAGHELPER_SET_ACTIVE_TAG':
                if (action.payload['sourceId'] === this.sourceId &&
                        this.ident !== action.payload['value']) {
                    this.suspend(
                        {},
                        (nextAction, syncObj) => this.ident === nextAction.payload['value'] ?
                            null : syncObj
                    ).subscribe(); // TODO is this correct?
                }
            break;
        }
    }

    private getFilteredFeatures(state:UDTagBuilderModelState, dispatch:SEDispatcher,
            actionDone:string, useFilter:boolean) {
        const baseArgs:Array<[string, string]> = [
            tuple('corpname', state.corpname),
            tuple('tagset', state.tagsetName)
        ];
        const queryArgs:Array<[string, string]> = pipe(
            state.filterFeaturesHistory,
            List.last(),
            List.map(x => x.getKeyval())
        );

        this.pluginApi.ajax$(
            HTTP.Method.GET,
            this.pluginApi.createActionUrl(
                'corpora/ajax_get_tag_variants',
                useFilter ? baseArgs.concat(queryArgs) : baseArgs
            ),
            {}

        ).subscribe(
            (result) => {
                dispatch({
                    name: actionDone,
                    payload: {
                        sourceId: this.sourceId,
                        result: result['keyval_tags']
                    }
                });
            },
            (error) => {
                dispatch({
                    name: actionDone,
                    error,
                    payload: {
                        sourceId: this.sourceId
                    }
                });
            }
        )
    }

}
