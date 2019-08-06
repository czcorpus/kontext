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

import {IPluginApi} from '../../types/plugins';
import * as Immutable from 'immutable';
import RSVP from 'rsvp';
import { StatelessModel, IActionDispatcher, Action, SEDispatcher } from 'kombo';


type RawTagValues = Array<Array<Array<string>>>;

type UpdateTagValues = {[idx:number]:Array<Array<string>>};

/**
 * Defines a JSON format used by server
 */
export interface TagDataResponse {
    containsErrors:boolean;
    messages:Array<string>;
    labels:Array<string>;
    tags:RawTagValues;
}

/**
 * Defines a single value available in a specific position
 * (e.g. 2nd position, 1st item = 'masculine inanimate')
 */
export interface PositionValue {
    id:string;
    title:string;
    selected:boolean;
    available:boolean;
}

/**
 * Defines options for a single PoS tag position (e.g.: 2nd position = Gender)
 */
export interface PositionOptions {
    label:string;
    values:Immutable.List<PositionValue>;
    locked:boolean;
}


export interface TagHelperModelState {

    corpname:string;

    /**
     * Contains all the values (inner lists) along with selection
     * status through whole user interaction (outer list).
     */
    data:Immutable.List<Immutable.List<PositionOptions>>;

    positions:Immutable.List<PositionOptions>;

    presetPattern:string;

    displayPattern:string;

    srchPattern:string;

    isBusy:boolean;

    canUndo:boolean;

    stateId:string;
}

/**
 * This model handles a single tag-builder instance.
 */
export class TagHelperModel extends StatelessModel<TagHelperModelState> {

    static DispatchToken:string;

    private pluginApi:IPluginApi;


    constructor(dispatcher:IActionDispatcher, pluginApi:IPluginApi, corpname:string) {
        const positions = Immutable.List<PositionOptions>();
        super(
            dispatcher,
            {
                corpname: corpname,
                data: Immutable.List<Immutable.List<PositionOptions>>().push(positions),
                positions: positions,
                presetPattern: '',
                srchPattern: '.*',
                displayPattern: '.*',
                isBusy: false,
                canUndo: false,
                stateId: ''
            }
        );
        this.pluginApi = pluginApi;
    }


    reduce(state:TagHelperModelState, action:Action):TagHelperModelState {
        const newState = this.copyState(state);
        switch (action.name) {
            case 'TAGHELPER_PRESET_PATTERN':
                newState.presetPattern = action.payload['pattern'];
                if (newState.data.last().size > 0) {
                    this.applyPresetPattern(newState);
                }
            break;
            case 'TAGHELPER_GET_INITIAL_DATA':
                if (newState.data.last().size === 0) {
                    newState.isBusy = true;
                }
            break;
            case 'TAGHELPER_GET_INITIAL_DATA_DONE':
                newState.isBusy = false;
                if (!action.error) {
                    this.importData(newState, action.payload['labels'], action.payload['tags']);
                    if (newState.presetPattern) {
                        this.applyPresetPattern(newState);
                    }

                } else {
                    this.pluginApi.showMessage('error', action.error);
                }
            break;
            case 'TAGHELPER_CHECKBOX_CHANGED':
                this.updateSelectedItem(newState, action.payload['position'], action.payload['value'],
                        action.payload['checked']);
                newState.isBusy = true;
            break;
            case 'TAGHELPER_LOAD_FILTERED_DATA_DONE':
                newState.isBusy = false;
                if (!action.error) {
                    this.mergeData(
                        newState,
                        action.payload['tags'],
                        action.payload['triggerRow']
                    );

                } else {
                    this.pluginApi.showMessage('error', action.error);
                }
            break;
            case 'TAGHELPER_UNDO':
                this.undo(newState);
            break;
            case 'TAGHELPER_RESET':
                this.resetSelections(newState);
            break;
            default:
                return state;
        }
        return newState;
    }

    sideEffects(state:TagHelperModelState, action:Action, dispatch:SEDispatcher) {
        switch (action.name) {
            case 'TAGHELPER_GET_INITIAL_DATA':
                if (state.data.last().size === 0) {
                    this.loadInitialData(state).then(
                        (data) => {
                            dispatch({
                                name: 'TAGHELPER_GET_INITIAL_DATA_DONE',
                                payload: {
                                    labels: data.labels,
                                    tags: data.tags
                                }
                            });

                        },
                        (err) => {
                            dispatch({
                                name: 'TAGHELPER_GET_INITIAL_DATA_DONE',
                                payload: {
                                    labels: [],
                                    tags: []
                                },
                                error: err
                            });
                        }
                    );
                }
            break;
            case 'TAGHELPER_CHECKBOX_CHANGED':
            this.updateData(state, action.payload['position']).then(
                (data) => {
                    dispatch({
                        name: 'TAGHELPER_LOAD_FILTERED_DATA_DONE',
                        payload: {
                            tags: data.tags,
                            triggerRow: action.payload['position']
                        }
                    });
                },
                (err) => {
                    dispatch({
                        name: 'TAGHELPER_LOAD_FILTERED_DATA_DONE',
                        payload: {},
                        error: err
                    });
                }
            );
            break;
        }
    }

    private loadInitialData(state:TagHelperModelState):RSVP.Promise<TagDataResponse> {
        return this.pluginApi.ajax<TagDataResponse>(
            'GET',
            this.pluginApi.createActionUrl('corpora/ajax_get_tag_variants'),
            { corpname: state.corpname }
        );
    }

    private updateData(state:TagHelperModelState, triggerRow:number):RSVP.Promise<TagDataResponse> {
        let prom:RSVP.Promise<TagDataResponse> = this.pluginApi.ajax<TagDataResponse>(
            'GET',
            this.pluginApi.createActionUrl('corpora/ajax_get_tag_variants'),
            {
                corpname: state.corpname,
                pattern: state.srchPattern
            }
        );
        return prom.then(
            (data) => {
                return data;
            }
        );
    }

    private resetSelections(state:TagHelperModelState):void {
        state.data = state.data.slice(0, 2).toList();
        state.positions = state.data.last();
        state.canUndo = this.canUndo(state);
        state.srchPattern = this.getCurrentPattern(state);
        state.displayPattern = this.exportCurrentPattern(state);
    }

    private undo(state:TagHelperModelState):void {
        if (state.data.size > 2) {
            state.data = state.data.slice(0, -1).toList();
            state.positions = state.data.last();
        }
        state.canUndo = this.canUndo(state);
        state.srchPattern = this.getCurrentPattern(state);
        state.displayPattern = this.exportCurrentPattern(state);
    }

    /**
     * Try to parse preset pattern and check matching checkboxes
     * according to parsed values. This is used along with advanced
     * CQL editor.
     */
    private applyPresetPattern(state:TagHelperModelState):void {
        if (/^\||[^\\]\|/.exec(state.presetPattern)) {
            this.pluginApi.showMessage('warning', this.pluginApi.translate('taghelper__cannot_parse'));
        }
        const parsePattern = /\[\\?[^\]]+\]|\\?[^\]^\[^\.]|\.\*|\./g;
        const values = [];
        let item = null;
        while ((item = parsePattern.exec(state.presetPattern)) !== null) {
            values.push(item[0].substr(0, 1) === '[' ? item[0].substring(1, item[0].length - 1) : item[0]);
        }
        for (let i = 0; i < state.data.last().size; i +=1 ) {
            const oldPos = state.data.last().get(i);
            const newPos:PositionOptions = {
                label: oldPos.label,
                values: oldPos.values.map((item:PositionValue) => {
                    return {
                        id: item.id,
                        title: item.title,
                        selected: (values[i] || '').indexOf(item.id) > -1 ? true : false,
                        available: item.available
                    }
                }).toList(),
                locked: oldPos.locked
            };
            state.data = state.data.push(state.data.last().set(i, newPos));
        }
        state.positions = state.data.last();
        state.canUndo = false;
        state.srchPattern = this.getCurrentPattern(state);
        state.displayPattern = this.exportCurrentPattern(state);
        state.presetPattern = null;
    }

    /**
     * Performs an initial import (i.e. any previous data is lost)
     */
    private importData(state:TagHelperModelState, labels:Array<string>, data:RawTagValues):void {
        state.data = state.data.push(Immutable.List<PositionOptions>(
            data.map<PositionOptions>((position:Array<Array<string>>, i:number) => {
                return {
                    label: labels[i],
                    locked: false,
                    values:  Immutable.List<PositionValue>(position.map<PositionValue>((item: Array<string>) => {
                        return {
                            id: item[0],
                            title: item[1],
                            selected: false,
                            available: true
                        }
                    }))
                };
            })
        ));
        state.positions = state.data.last();
        state.stateId = this.getStateId(state);
        state.canUndo = this.canUndo(state);
    }

    private hasSelectedItemsAt(opt:PositionOptions):boolean {
        return opt.values.some((item:PositionValue) => item.selected === true);
    }

    private hasSelectedItems(state:TagHelperModelState):boolean {
        return state.data.last()
            .flatMap(item => item.values
            .map(subitem => subitem.selected))
            .find(x => x === true) !== undefined;
    }

    /**
     * Merges data from server (generated by the current tag pattern) with
     * the current data. This actually means several things:
     * 1) any unlocked block with selected items and different than the
     *    current one is locked
     * 2) any position option value not found in server response is made unavalilable
     */
    private mergeData(state:TagHelperModelState, tags:UpdateTagValues, triggerRow:number):void {
        const newItem = state.data.last().map((item:PositionOptions, i:number) => {
            let posOpts:PositionOptions;
            if (!item.locked && this.hasSelectedItemsAt(item) && i !== triggerRow) {
                posOpts = {
                    label: item.label,
                    values: item.values,
                    locked: true
                };

            } else if (i !== triggerRow && !item.locked) {
                const tmp = Immutable.Map(tags[i]);
                posOpts = {
                    label: item.label,
                    values: item.values.map((v:PositionValue) => {
                        return {
                            id: v.id,
                            title: v.title,
                            selected: v.selected,
                            available: tmp.get(v.id) === undefined ? false : true
                        }

                    }).toList(),
                    locked: item.locked
                };
            } else {
                posOpts = item;
            }
            return posOpts;
        }).toList();
        state.data = state.data.pop().push(newItem);
        state.stateId = this.getStateId(state);
        state.positions = state.data.last();
        state.canUndo = this.canUndo(state);
    }

    /**
     * Changes the 'checked' status of an item specified by a position and a value
     * (.e.g. 2nd position (gender), F value (feminine))
     */
    private updateSelectedItem(state:TagHelperModelState, position:number, value:string, checked:boolean):void {
        const oldPos = state.data.last().get(position);
        const newPos:PositionOptions = {
            label: oldPos.label,
            values: oldPos.values.map((item:PositionValue) => {
                return {
                    id: item.id,
                    title: item.title,
                    selected: item.id === value ? checked : item.selected,
                    available: item.available
                }
            }).toList(),
            locked: oldPos.locked
        };
        state.data = state.data.push(state.data.last().set(position, newPos));
        state.srchPattern = this.getCurrentPattern(state);
        state.displayPattern = this.exportCurrentPattern(state);
    }

    private canUndo(state:TagHelperModelState):boolean {
        return state.data.size > 2;
    }

    private getCurrentPattern(state:TagHelperModelState):string {
        function exportPosition(v) {
            if (v.size > 1) {
                return '[' + v.join('') + ']';

            } else if (v.size === 1) {
                return v.join('');

            } else {
                return '.';
            }
        }
        if (this.hasSelectedItems(state)) {
            return state.data.last().map<string>((item:PositionOptions) => {
                return exportPosition(item.values
                            .filter((s:PositionValue) => s.selected)
                            .map<string>((s:PositionValue) => s.id)
                );
            }).join('');

        } else {
            return '.*';
        }
    }

    private exportCurrentPattern(state:TagHelperModelState):string {
        return this.getCurrentPattern(state).replace(/\.\.+$/,  '.*');
    }

    /**
     * Return options for a selected position (e.g. position 2: M, I, F, N, X)
     */
    getOptions(state:TagHelperModelState, position:number):PositionOptions {
        return state.data.last().get(position);
    }

    /**
     * Return an unique state identifier
     */
    private getStateId(state:TagHelperModelState):string {
        return state.data.last().map<string>((item:PositionOptions) => {
            const ans = item.values.filter((s:PositionValue) => s.selected)
                    .map<string>((s:PositionValue) => s.id);
            return ans.size > 0 ? '[' + ans.join('') + ']' : ''
        }).join('');
    }
}