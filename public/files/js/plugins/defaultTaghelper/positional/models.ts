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

import { IPluginApi } from '../../../types/plugins';
import { StatelessModel, IActionDispatcher, Action, SEDispatcher } from 'kombo';
import { TagBuilderBaseState } from '../common';
import { Observable, of as rxOf } from 'rxjs';
import { List, pipe } from 'cnc-tskit';


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
    values:Array<PositionValue>;
    isLocked:boolean;
    isActive:boolean;
}


export interface TagHelperModelState extends TagBuilderBaseState {

    /**
     * Contains all the values (inner lists) along with selection
     * status through whole user interaction (outer list).
     */
    data:Array<Array<PositionOptions>>;

    positions:Array<PositionOptions>;

    presetPattern:string;

    rawPattern:string;

    generatedQuery:string;

    srchPattern:string;

    tagAttr:string;
}

/**
 * This model handles a single tag-builder instance.
 */
export class TagHelperModel extends StatelessModel<TagHelperModelState> {

    private readonly pluginApi:IPluginApi;

    private readonly ident:string;

    private readonly sourceId:string;


    constructor(dispatcher:IActionDispatcher, pluginApi:IPluginApi,
            initialState:TagHelperModelState, ident:string) {
        super(dispatcher, initialState);
        this.pluginApi = pluginApi;
        this.ident = ident;
        this.sourceId = initialState.corpname;
        this.actionMatch = {
            'TAGHELPER_PRESET_PATTERN': (state, action) => {
                if (action.payload['sourceId'] === this.sourceId) {
                    const newState = this.copyState(state);
                    newState.presetPattern = action.payload['pattern'];
                    if (List.last(newState.data).length > 0) {
                        this.applyPresetPattern(newState);
                    }
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
                return state;
            },
            'TAGHELPER_GET_INITIAL_DATA_DONE': (state, action) => {
                if (action.payload['sourceId'] === this.sourceId) {
                    const newState = this.copyState(state);
                    newState.isBusy = false;
                    if (!action.error) {
                        if (Array.isArray(action.payload['tags']) &&
                                action.payload['tags'].length > 0) {
                            this.importData(
                                newState,
                                action.payload['labels'],
                                action.payload['tags']
                            );
                            if (newState.presetPattern) {
                                this.applyPresetPattern(newState);
                            }
                        }

                    } else {
                        // TODO fix side effect here
                        this.pluginApi.showMessage('error', action.error);
                    }
                    return newState;
                }
                return state;
            },
            'TAGHELPER_CHECKBOX_CHANGED': (state, action) => {
                if (action.payload['sourceId'] === this.sourceId) {
                    const newState = this.copyState(state);
                    this.updateSelectedItem(
                        newState,
                        action.payload['position'],
                        action.payload['value'],
                        action.payload['checked']
                    );
                    newState.isBusy = true;
                    return newState;
                }
                return state;
            },
            'TAGHELPER_LOAD_FILTERED_DATA_DONE': (state, action) => {
                if (action.payload['sourceId'] === this.sourceId) {
                    const newState = this.copyState(state);
                    newState.isBusy = false;
                    if (!action.error) {
                        this.mergeData(
                            newState,
                            action.payload['tags'],
                            action.payload['triggerRow']
                        );

                    } else {
                        // TODO fix side effect
                        this.pluginApi.showMessage('error', action.error);
                    }
                    return newState;
                }
                return state;
            },
            'TAGHELPER_UNDO': (state, action) => {
                if (action.payload['sourceId'] === this.sourceId) {
                    const newState = this.copyState(state);
                    this.undo(newState);
                    return newState;
                }
                return state;
            },
            'TAGHELPER_RESET': (state, action) => {
                if (action.payload['sourceId'] === this.sourceId) {
                    const newState = this.copyState(state);
                    this.resetSelections(newState);
                    return newState;
                }
                return state;
            },
            'TAGHELPER_TOGGLE_ACTIVE_POSITION': (state, action) => {
                if (action.payload['sourceId'] === this.sourceId) {
                    const newState = this.copyState(state);
                    const latest = List.last(newState.data);
                    newState.data.push(
                        List.map(
                            (item, i) => ({
                                ...item,
                                isActive: i === action.payload['idx'] ?
                                    !item.isActive : item.isActive
                            }),
                            latest
                        )
                    );
                    newState.positions = List.last(newState.data);
                    return newState;
                }
                return state;
            }
        }
    }

    sideEffects(state:TagHelperModelState, action:Action, dispatch:SEDispatcher) {
        switch (action.name) {
            case 'TAGHELPER_GET_INITIAL_DATA':
                if (action.payload['sourceId'] === this.sourceId) {
                    (List.last(state.data).length === 0 ?
                        this.loadInitialData(state) :
                        rxOf({
                            labels: [],
                            tags: []
                        })
                    ).subscribe(
                        (data) => {
                            dispatch({
                                name: 'TAGHELPER_GET_INITIAL_DATA_DONE',
                                payload: {
                                    sourceId: this.sourceId,
                                    labels: data.labels,
                                    tags: data.tags
                                }
                            });

                        },
                        (err) => {
                            dispatch({
                                name: 'TAGHELPER_GET_INITIAL_DATA_DONE',
                                payload: {
                                    sourceId: this.sourceId,
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
            if (action.payload['sourceId'] === this.sourceId) {
                this.updateData(state, action.payload['position']).subscribe(
                    (data) => {
                        dispatch({
                            name: 'TAGHELPER_LOAD_FILTERED_DATA_DONE',
                            payload: {
                                sourceId: this.sourceId,
                                tags: data.tags,
                                triggerRow: action.payload['position']
                            }
                        });
                    },
                    (err) => {
                        dispatch({
                            name: 'TAGHELPER_LOAD_FILTERED_DATA_DONE',
                            payload: {
                                sourceId: this.sourceId
                            },
                            error: err
                        });
                    }
                );
            }
            break;
            case 'TAGHELPER_SET_ACTIVE_TAG':
                if (action.payload['sourceId'] === this.sourceId &&
                        this.ident !== action.payload['value']) {
                    this.suspend(
                        {},
                        (action, syncObj) => this.ident === action.payload['value']
                            ? null : syncObj
                    ).subscribe(); // TODO is this correct ?
                }
            break;
        }
    }

    private loadInitialData(state:TagHelperModelState):Observable<TagDataResponse> {
        return this.pluginApi.ajax$<TagDataResponse>(
            'GET',
            this.pluginApi.createActionUrl(
                'corpora/ajax_get_tag_variants',
                [
                    ['corpname', state.corpname],
                    ['tagset', state.tagsetName]
                ]
            ),
            {}
        );
    }

    private updateData(state:TagHelperModelState, triggerRow:number):Observable<TagDataResponse> {
        return this.pluginApi.ajax$<TagDataResponse>(
            'GET',
            this.pluginApi.createActionUrl(
                'corpora/ajax_get_tag_variants',
                [
                    ['corpname', state.corpname],
                    ['tagset', state.tagsetName],
                    ['pattern', state.srchPattern]
                ]
            ),
            {}
        );
    }

    private resetSelections(state:TagHelperModelState):void {
        state.data = state.data.slice(0, 2);
        state.positions = List.last(state.data);
        state.canUndo = this.canUndo(state);
        state.srchPattern = this.getCurrentPattern(state);
        [state.rawPattern, state.generatedQuery] = this.exportCurrentPattern(state);
    }

    private undo(state:TagHelperModelState):void {
        if (state.data.length > 2) {
            state.data = state.data.slice(0, -1);
            state.positions = List.last(state.data);
        }
        state.canUndo = this.canUndo(state);
        state.srchPattern = this.getCurrentPattern(state);
        [state.rawPattern, state.generatedQuery] = this.exportCurrentPattern(state);
    }

    /**
     * Try to parse preset pattern and check matching checkboxes
     * according to parsed values. This is used along with advanced
     * CQL editor.
     */
    private applyPresetPattern(state:TagHelperModelState):void {
        if (/^\||[^\\]\|/.exec(state.presetPattern)) {
            this.pluginApi.showMessage(
                'warning',
                this.pluginApi.translate('taghelper__cannot_parse')
            );
        }
        const parsePattern = /\[\\?[^\]]+\]|\\?[^\]^\[^\.]|\.\*|\./g;
        const values = [];
        let item = parsePattern.exec(state.presetPattern);
        while (item !== null) {
            values.push(item[0].substr(0, 1) === '[' ?
                item[0].substring(1, item[0].length - 1) : item[0]);
            item = parsePattern.exec(state.presetPattern);
        }
        for (let i = 0; i < List.last(state.data).length; i +=1 ) {
            const oldPos = List.last(state.data)[i];
            const newPos:PositionOptions = {
                label: oldPos.label,
                values: oldPos.values.map((item:PositionValue) => {
                    return {
                        id: item.id,
                        title: item.title,
                        selected: (values[i] || '').indexOf(item.id) > -1 ? true : false,
                        available: item.available
                    }
                }),
                isLocked: oldPos.isLocked,
                isActive: oldPos.isActive
            };
            const lst = List.last(state.data);
            lst[i] = newPos;
            state.data.push(lst);
        }
        state.positions = List.last(state.data);
        state.canUndo = false;
        state.srchPattern = this.getCurrentPattern(state);
        [state.rawPattern, state.generatedQuery] = this.exportCurrentPattern(state);
        state.presetPattern = null;
    }

    /**
     * Performs an initial import (i.e. any previous data is lost)
     */
    private importData(state:TagHelperModelState, labels:Array<string>, data:RawTagValues):void {
        state.data.push(List.map(
            (position:Array<Array<string>>, i:number) => ({
                label: labels[i],
                isLocked: false,
                isActive: false,
                values: List.map(
                    (item:Array<string>) => ({
                        id: item[0],
                        title: item[1],
                        selected: false,
                        available: true
                    }),
                    position
                )
            }),
            data
        ));
        state.positions = List.last(state.data);
        state.canUndo = this.canUndo(state);
    }

    private hasSelectedItemsAt(opt:PositionOptions):boolean {
        return opt.values.some((item:PositionValue) => item.selected === true);
    }

    private hasSelectedItems(state:TagHelperModelState):boolean {
        return pipe(
            state.data,
            List.last(),
            List.flatMap(item => item.values),
            List.map(subitem => subitem.selected),
            List.some(x => x === true)
        );
    }

    /**
     * Merges data from server (generated by the current tag pattern) with
     * the current data. This actually means several things:
     * 1) any unlocked block with selected items and different than the
     *    current one is locked
     * 2) any position option value not found in server response is made unavalilable
     */
    private mergeData(state:TagHelperModelState, tags:UpdateTagValues, triggerRow:number):void {
        const newItem = pipe(
            state.data,
            List.last(),
            List.map(
                (item:PositionOptions, i:number) => {
                    let posOpts:PositionOptions;
                    if (!item.isLocked && this.hasSelectedItemsAt(item) && i !== triggerRow) {
                        posOpts = {
                            label: item.label,
                            values: item.values,
                            isLocked: true,
                            isActive: item.isActive
                        };

                    } else if (i !== triggerRow && !item.isLocked) {
                        const tmp = tags[i];
                        posOpts = {
                            label: item.label,
                            values: List.map(
                                (v:PositionValue) => ({
                                    ...v,
                                    available: tmp[v.id] !== undefined
                                }),
                                item.values
                            ),
                            isLocked: item.isLocked,
                            isActive: item.isActive
                        };
                    } else {
                        posOpts = item;
                    }
                    return posOpts;
                },
            )
        );
        state.data.pop();
        state.data.push(newItem);
        state.positions = List.last(state.data);
        state.canUndo = this.canUndo(state);
    }

    /**
     * Changes the 'checked' status of an item specified by a position and a value
     * (.e.g. 2nd position (gender), F value (feminine))
     */
    private updateSelectedItem(state:TagHelperModelState, position:number, value:string,
            checked:boolean):void {
        const oldPos = List.last(state.data)[position];
        const newPos:PositionOptions = {
            label: oldPos.label,
            values: List.map(
                (item:PositionValue) => ({
                    ...item,
                    selected: item.id === value ? checked : item.selected,
                }),
                oldPos.values
            ),
            isLocked: oldPos.isLocked,
            isActive: oldPos.isActive
        };
        const lastItem = List.last(state.data);
        lastItem[position] = newPos;
        state.data.push(lastItem);
        state.srchPattern = this.getCurrentPattern(state);
        [state.rawPattern, state.generatedQuery] = this.exportCurrentPattern(state);
    }

    private canUndo(state:TagHelperModelState):boolean {
        return state.data.length > 2;
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
            return pipe(
                state.data,
                List.last(),
                List.map(
                    item => exportPosition(
                        pipe(
                            item.values,
                            List.filter(s => s.selected),
                            List.map(s => s.id)
                        )
                    )
                )
            ).join('');

        } else {
            return '.*';
        }
    }

    private exportCurrentPattern(state:TagHelperModelState):[string, string] {
        const ans = this.getCurrentPattern(state).replace(/\.\.+$/,  '.*');
        return [ans, `${state.tagAttr}="${ans}"`];
    }

    /**
     * Return options for a selected position (e.g. position 2: M, I, F, N, X)
     */
    getOptions(state:TagHelperModelState, position:number):PositionOptions {
        return List.last(state.data)[position];
    }
}