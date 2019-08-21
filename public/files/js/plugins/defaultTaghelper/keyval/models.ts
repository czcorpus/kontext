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
import * as Immutable from 'immutable';
import { TagBuilderBaseState } from '../common';


export interface FeatureSelectProps {
    error:Error|null;
    allFeatures:Immutable.Map<string, Immutable.List<string>>;
    availableFeatures:Immutable.Map<string, Immutable.List<string>>;
    filterFeaturesHistory:Immutable.List<Immutable.List<FilterRecord>>;
    showCategory:string;
}

export class FilterRecord extends Immutable.Record({name: undefined, value: undefined}) {
    composeString():string {
        return this.valueSeq().join('=');
    }

    compare(that:FilterRecord):number {
        return this.composeString() < that.composeString() ? -1 : 1;
    }
}

function composeQuery(state:UDTagBuilderModelState):string {
    return state.filterFeaturesHistory.last().groupBy(x => x.get('name')).map(
        (value, key) =>
            key==='POS' ?
            `${state.posField}="${value.map(x => x.get('value')).join('|')}"` :
            `${state.featureField}="${value.map(x => x.composeString()).join('|')}"`
    ).valueSeq().sort().join(' & ');
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
    allFeatures: Immutable.Map<string, Immutable.List<string>>,
    availableFeatures: Immutable.Map<string, Immutable.List<string>>,
    filterFeaturesHistory: Immutable.List<Immutable.List<FilterRecord>>;
    showCategory: string;

    posField: string;
    featureField: string;
}

export class UDTagBuilderModel extends StatelessModel<UDTagBuilderModelState> {

    private pluginApi:IPluginApi;

    constructor(dispatcher:IActionDispatcher, pluginApi:IPluginApi, initialState:UDTagBuilderModelState) {
        super(dispatcher, initialState);
        this.pluginApi = pluginApi;

        this.actionMatch = {
            'TAGHELPER_SELECT_CATEGORY': (state, action) => {
                const newState = this.copyState(state);
                newState.showCategory = action.payload['value'];
                return newState;
            },
            'TAGHELPER_GET_INITIAL_FEATURES': (state, action) => {
                const newState = this.copyState(state);
                newState.isBusy = true;
                return newState;
            },
            'TAGHELPER_GET_INITIAL_FEATURES_DONE': (state, action) => {
                const newState = this.copyState(state);
                if (!action.error) {
                    newState.allFeatures = Immutable.fromJS(action.payload['result']);
                    newState.availableFeatures = newState.allFeatures;
                    newState.showCategory = newState.allFeatures.keySeq().sort().first()
                } else {
                    newState.error = action.error;
                }
                newState.isBusy = false;
                return newState;
            },
            'TAGHELPER_LOAD_FILTERED_DATA_DONE': (state, action) => {
                const newState = this.copyState(state);
                if (!action.error) {
                    newState.availableFeatures = Immutable.fromJS(action.payload['result']);
                } else {
                    newState.error = action.error;
                }
                newState.isBusy = false;
                return newState;
            },
            'TAGHELPER_ADD_FILTER': (state, action) => {
                const newState = this.copyState(state);
                const filter = new FilterRecord(action.payload);
                const filterFeatures = newState.filterFeaturesHistory.last();
                newState.isBusy = true;
                if (filterFeatures.every(x => !x.equals(filter))) {
                    const newFilterFeatures = filterFeatures.push(filter);
                    newState.filterFeaturesHistory = newState.filterFeaturesHistory.push(newFilterFeatures);
                    newState.canUndo = true;
                    newState.generatedQuery = composeQuery(newState);
                }
                return newState;
            },
            'TAGHELPER_REMOVE_FILTER': (state, action) => {
                const newState = this.copyState(state);
                const filter = new FilterRecord(action.payload);
                const filterFeatures = newState.filterFeaturesHistory.last();

                const newFilterFeatures = filterFeatures.filterNot((value) => value.equals(filter));
                newState.filterFeaturesHistory = newState.filterFeaturesHistory.push(Immutable.List(newFilterFeatures))
                newState.canUndo = true;
                newState.isBusy = true;
                newState.generatedQuery = composeQuery(newState);

                return newState;
            },
            'TAGHELPER_UNDO': (state, action) => {
                const newState = this.copyState(state);
                newState.filterFeaturesHistory = newState.filterFeaturesHistory.delete(-1);
                if (newState.filterFeaturesHistory.size===1) {
                    newState.canUndo = false;
                }
                newState.isBusy = true;
                newState.generatedQuery = composeQuery(newState);
                return newState;
            },
            'TAGHELPER_RESET': (state, action) => {
                const newState = this.copyState(state);
                newState.filterFeaturesHistory = Immutable.List([Immutable.List([])]);
                newState.availableFeatures = newState.allFeatures;
                newState.canUndo = false;
                newState.generatedQuery = composeQuery(newState);
                return newState;
            }
        };
    }

    sideEffects(state:UDTagBuilderModelState, action:Action, dispatch:SEDispatcher) {
        switch (action.name) {
            case 'TAGHELPER_GET_INITIAL_FEATURES':
                getFilteredFeatures(this.pluginApi, state, dispatch, 'TAGHELPER_GET_INITIAL_FEATURES_DONE');
            break;

            case 'TAGHELPER_ADD_FILTER':
            case 'TAGHELPER_REMOVE_FILTER':
            case 'TAGHELPER_UNDO':
                getFilteredFeatures(this.pluginApi, state, dispatch, 'TAGHELPER_LOAD_FILTERED_DATA_DONE');
            break;
        }
    }

}

function getFilteredFeatures(pluginApi:IPluginApi, state:UDTagBuilderModelState, dispatch:SEDispatcher, actionDone: string) {
    const query = state.filterFeaturesHistory.last().map(x => x.composeString()).join('&');
    const requestUrl = pluginApi.createActionUrl('corpora/ajax_get_tag_variants');
    pluginApi.ajax$(
        'GET',
        query ? requestUrl + '?' + query : requestUrl,
        { corpname: state.corpname }
    ).subscribe(
        (result) => {
            dispatch({
                name: actionDone,
                payload: {result: result['keyval_tags']}
            });
        },
        (error) => {
            dispatch({
                name: actionDone,
                error: error
            });
        }
    )
}
