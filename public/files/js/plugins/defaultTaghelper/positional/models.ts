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

import { Observable, of as rxOf } from 'rxjs';
import { List, pipe, HTTP, Dict } from 'cnc-tskit';
import { StatelessModel, IActionDispatcher } from 'kombo';

import { IPluginApi } from '../../../types/plugins';
import { TagBuilderBaseState } from '../common';
import { Actions, ActionName } from '../actions';
import { Actions as QueryActions,
    ActionName as QueryActionName } from '../../../models/query/actions';


type RawTagValues = Array<Array<[string, string]>>;


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

function cloneSelection(data:Array<PositionOptions>):Array<PositionOptions> {
    return List.map(
        item => ({
            ...item,
            values: List.map(
                value => ({...value}),
                item.values
            )
        }),
        data
    );
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

        this.addActionSubtypeHandler<QueryActions.QueryTaghelperPresetPattern>(
            QueryActionName.QueryTaghelperPresetPattern,
            action => action.payload.sourceId === this.sourceId,
            (state, action) => {
                state.presetPattern = action.payload.pattern;
                if (!pipe(state.data, List.last(), List.empty())) {
                    this.applyPresetPattern(state);
                }
            }
        );

        this.addActionSubtypeHandler<Actions.GetInitialData>(
            ActionName.GetInitialData,
            action => action.payload.sourceId === this.sourceId,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                (List.last(state.data).length === 0 ?
                    this.loadInitialData(state) :
                    rxOf({
                        labels: [],
                        tags: []
                    })
                ).subscribe(
                    (data) => {
                        dispatch<Actions.GetInitialDataDone>({
                            name: ActionName.GetInitialDataDone,
                            payload: {
                                sourceId: this.sourceId,
                                labels: data.labels,
                                tags: data.tags
                            }
                        });

                    },
                    (err) => {
                        dispatch<Actions.GetInitialDataDone>({
                            name: ActionName.GetInitialDataDone,
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
        );

        this.addActionSubtypeHandler<Actions.GetInitialDataDone>(
            ActionName.GetInitialDataDone,
            action => action.payload.sourceId === this.sourceId,
            (state, action) => {
                state.isBusy = false;
                if (!action.error) {
                    if (Array.isArray(action.payload.tags) &&
                            action.payload.tags.length > 0) {
                        this.importData(
                            state,
                            action.payload.labels,
                            action.payload.tags
                        );
                        if (state.presetPattern) {
                            this.applyPresetPattern(state);
                        }
                    }

                } else {
                    // TODO fix side effect here
                    this.pluginApi.showMessage('error', action.error);
                }
            }
        );

        this.addActionSubtypeHandler<Actions.CheckboxChanged>(
            ActionName.CheckboxChanged,
            action => action.payload.sourceId === this.sourceId,
            (state, action) => {
                this.updateSelectedItem(
                    state,
                    action.payload.position,
                    action.payload.value,
                    action.payload.checked
                );
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.updateData(state, action.payload.position).subscribe(
                    (data) => {
                        dispatch<Actions.LoadFilteredDataDone>({
                            name: ActionName.LoadFilteredDataDone,
                            payload: {
                                sourceId: this.sourceId,
                                tags: data.tags,
                                triggerRow: action.payload.position
                            }
                        });
                    },
                    (err) => {
                        dispatch<Actions.LoadFilteredDataDone>({
                            name: ActionName.LoadFilteredDataDone,
                            payload: {
                                sourceId: this.sourceId,
                                tags: [],
                                triggerRow: action.payload.position
                            },
                            error: err
                        });
                    }
                );
            }
        );

        this.addActionSubtypeHandler<Actions.LoadFilteredDataDone>(
            ActionName.LoadFilteredDataDone,
            action => action.payload.sourceId === this.sourceId,
            (state, action) => {
                state.isBusy = false;
                if (!action.error) {
                    this.mergeData(
                        state,
                        action.payload.tags,
                        action.payload.triggerRow
                    );

                } else {
                    // TODO fix side effect
                    this.pluginApi.showMessage('error', action.error);
                }
            }
        );

        this.addActionSubtypeHandler<Actions.Undo>(
            ActionName.Undo,
            action => action.payload.sourceId === this.sourceId,
            (state, action) => {
                this.undo(state);
            }
        );

        this.addActionSubtypeHandler<Actions.Reset>(
            ActionName.Reset,
            action => action.payload.sourceId === this.sourceId,
            (state, action) => {
                this.resetSelections(state);
            }
        );

        this.addActionSubtypeHandler<Actions.ToggleActivePosition>(
            ActionName.ToggleActivePosition,
            action => action.payload.sourceId === this.sourceId,
            (state, action) => {
                const latest = List.last(state.data);
                state.data.push(
                    List.map(
                        (item, i) => ({
                            ...item,
                            isActive: i === action.payload['idx'] ?
                                !item.isActive : item.isActive
                        }),
                        latest
                    )
                );
                state.positions = List.last(state.data);
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
                        (action:Actions.SetActiveTag, syncObj) =>
                            this.ident === action.payload.value
                        ? null : syncObj
                    ).subscribe(); // TODO is this correct ?
                }
            }
        );
    }

    private loadInitialData(state:TagHelperModelState):Observable<TagDataResponse> {
        return this.pluginApi.ajax$<TagDataResponse>(
            HTTP.Method.GET,
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
            HTTP.Method.GET,
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
        pipe(
            state.data,
            List.last(),
            List.forEach(
                (oldPos, i) => {
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
            )
        );
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
    private mergeData(state:TagHelperModelState, tags:RawTagValues, triggerRow:number):void {
        const mappedTags = pipe(
            tags,
            List.map(Dict.fromEntries())
        );

        const newItem = pipe(
            state.data,
            List.last(),
            List.map(
                (item:PositionOptions, i:number) => {
                    let posOpts:PositionOptions;
                    if (!item.isLocked && this.hasSelectedItemsAt(item) && i !== triggerRow) {
                        posOpts = {
                            ...item,
                            isLocked: true
                        };

                    } else if (i !== triggerRow && !item.isLocked) {
                        const serverFiltered = mappedTags[i];
                        posOpts = {
                            ...item,
                            values: List.map(
                                v => ({
                                    ...v,
                                    available: serverFiltered && serverFiltered[v.id] !== undefined
                                }),
                                item.values
                            )
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
            ...oldPos,
            values: List.map(
                (item:PositionValue) => ({
                    ...item,
                    selected: item.id === value ? checked : item.selected,
                }),
                oldPos.values
            )
        };
        const newSelection = cloneSelection(List.last(state.data));
        newSelection[position] = newPos;
        state.data.push(newSelection);
        state.srchPattern = this.getCurrentPattern(state);
        [state.rawPattern, state.generatedQuery] = this.exportCurrentPattern(state);
    }

    private canUndo(state:TagHelperModelState):boolean {
        return state.data.length > 2;
    }

    private getCurrentPattern(state:TagHelperModelState):string {

        function exportPosition(v:Array<string>):string {
            if (v.length > 1) {
                return '[' + v.join('') + ']';

            } else if (v.length === 1) {
                return v[0];

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