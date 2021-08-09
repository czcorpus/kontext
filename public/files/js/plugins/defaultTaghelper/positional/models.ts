/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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
import { StatefulModel, IFullActionControl } from 'kombo';

import * as PluginInterfaces from '../../../types/plugins';
import { TagBuilderBaseState } from '../common';
import { Actions } from '../actions';
import { Actions as QueryActions } from '../../../models/query/actions';
import { IPluginApi } from '../../../types/plugins/common';


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


export interface PosTagStatus {

    corpname:string;

    canUndo:boolean;

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

    /**
     * A valid CQL fragment directly applicable
     * within square brackets
     * "[EXPR_1 ... EXPR_K-1 RAW_PATTERN EXPR_K+1 ... EXPR_N]"
     *
     * This value is used when user inserts whole new tag expression.
     */
    generatedQuery:string;

    /**
     * Contains all the values (inner lists) along with selection
     * status through whole user interaction (outer list).
     */
    selHistory:Array<Array<PositionOptions>>;

    positions:Array<PositionOptions>;

    presetPattern:string;

    srchPattern:string;

    tagAttr:string;

    queryRange:[number, number];
}


export function createEmptyPosTagsetStatus(tagsetInfo:PluginInterfaces.TagHelper.TagsetInfo, corpname:string):PosTagStatus {
    return {
        corpname: corpname,
        selHistory: [[]],
        positions: [],
        tagAttr: tagsetInfo.featAttr,
        presetPattern: '',
        srchPattern: '.*',
        rawPattern: '.*',
        generatedQuery: `${tagsetInfo.featAttr}=".*"`,
        canUndo: false,
        queryRange: [0, 0]
    }
}


export interface PosTagModelState extends TagBuilderBaseState {

    data:{[sourceId:string]:PosTagStatus};
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
export class PosTagModel extends StatefulModel<PosTagModelState> {

    private readonly pluginApi:IPluginApi;

    private readonly tagsetId:string;


    constructor(
        dispatcher:IFullActionControl,
        pluginApi:IPluginApi,
        initialState:PosTagModelState,
        tagsetId:string
    ) {
        super(dispatcher, initialState);
        this.pluginApi = pluginApi;
        this.tagsetId = tagsetId;

        this.addActionSubtypeHandler<typeof QueryActions.QueryTaghelperPresetPattern>(
            QueryActions.QueryTaghelperPresetPattern.name,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                this.changeState(state => {
                    state.data[action.payload.sourceId].presetPattern = action.payload.pattern;
                    if (!pipe(state.data[action.payload.sourceId].selHistory, List.last(), List.empty())) {
                        this.applyPresetPattern(state, action.payload.sourceId);
                    }
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
                        state.data[action.payload.sourceId] = createEmptyPosTagsetStatus(
                                state.tagsetInfo, action.payload.corpname);
                    }
                });
                (List.last(this.state.data[action.payload.sourceId].selHistory).length === 0 ?
                    this.loadInitialData(action.payload.sourceId) :
                    rxOf({
                        labels: [],
                        tags: []
                    })
                ).subscribe(
                    (data) => {
                        this.dispatchSideEffect<typeof Actions.GetInitialDataDone>({
                            name: Actions.GetInitialDataDone.name,
                            payload: {
                                tagsetId: this.tagsetId,
                                sourceId: action.payload.sourceId,
                                labels: data.labels,
                                tags: data.tags
                            }
                        });

                    },
                    (err) => {
                        this.dispatchSideEffect<typeof Actions.GetInitialDataDone>({
                            name: Actions.GetInitialDataDone.name,
                            payload: {
                                tagsetId: this.tagsetId,
                                sourceId: action.payload.sourceId,
                                labels: [],
                                tags: []
                            },
                            error: err
                        });
                    }
                );
            }
        );

        this.addActionSubtypeHandler<typeof Actions.GetInitialDataDone>(
            Actions.GetInitialDataDone.name,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                this.changeState(state => {
                    state.isBusy = false;
                    if (!action.error) {
                        if (Array.isArray(action.payload.tags) &&
                                action.payload.tags.length > 0) {
                            this.importData(
                                state,
                                action.payload.labels,
                                action.payload.tags,
                                action.payload.sourceId
                            );
                            if (state.data[action.payload.sourceId].presetPattern) {
                                this.applyPresetPattern(state, action.payload.sourceId);
                            }
                        }

                    } else {
                        // TODO fix side effect here
                        this.pluginApi.showMessage('error', action.error);
                    }
                });
            }
        );

        this.addActionSubtypeHandler<typeof Actions.CheckboxChanged>(
            Actions.CheckboxChanged.name,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                this.changeState(state => {
                    this.updateSelectedItem(
                        state,
                        action.payload.position,
                        action.payload.value,
                        action.payload.checked,
                        action.payload.sourceId
                    );
                    state.isBusy = true;
                });
                this.updateData(action.payload.sourceId).subscribe(
                    (data) => {
                        this.dispatchSideEffect<typeof Actions.LoadFilteredDataDone>({
                            name: Actions.LoadFilteredDataDone.name,
                            payload: {
                                tagsetId: this.tagsetId,
                                sourceId: action.payload.sourceId,
                                tags: data.tags,
                                triggerRow: action.payload.position
                            }
                        });
                    },
                    (err) => {
                        this.dispatchSideEffect<typeof Actions.LoadFilteredDataDone>({
                            name: Actions.LoadFilteredDataDone.name,
                            payload: {
                                tagsetId: this.tagsetId,
                                sourceId: action.payload.sourceId,
                                tags: [],
                                triggerRow: action.payload.position
                            },
                            error: err
                        });
                    }
                );
            }
        );

        this.addActionSubtypeHandler<typeof Actions.LoadFilteredDataDone>(
            Actions.LoadFilteredDataDone.name,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                this.changeState(state => {
                    state.isBusy = false;
                    if (!action.error) {
                        this.mergeData(
                            state,
                            action.payload.tags,
                            action.payload.triggerRow,
                            action.payload.sourceId
                        );

                    } else {
                        // TODO fix side effect
                        this.pluginApi.showMessage('error', action.error);
                    }
                });
            }
        );

        this.addActionSubtypeHandler<typeof Actions.Undo>(
            Actions.Undo.name,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                this.changeState(state => {
                    this.undo(state, action.payload.sourceId);
                });
            }
        );

        this.addActionSubtypeHandler<typeof Actions.Reset>(
            Actions.Reset.name,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                this.changeState(state => {
                    this.resetSelections(state, action.payload.sourceId);
                });
            }
        );

        this.addActionSubtypeHandler<typeof Actions.ToggleActivePosition>(
            Actions.ToggleActivePosition.name,
            action => action.payload.tagsetId === this.tagsetId,
            action => {
                this.changeState(state => {
                    const latest = List.last(state.data[action.payload.sourceId].selHistory);
                    const activeItem = latest[action.payload.idx];
                    const newStep = List.map(
                        (item, i) => ({
                            ...item,
                            isActive: activeItem.isActive ? item.isActive : false
                        }),
                        latest
                    );
                    newStep[action.payload.idx].isActive = !newStep[action.payload.idx].isActive;
                    state.data[action.payload.sourceId].selHistory.push(newStep);
                    state.data[action.payload.sourceId].positions = List.last(
                        state.data[action.payload.sourceId].selHistory);
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
                        state.data[action.payload.sourceId] = createEmptyPosTagsetStatus(
                                state.tagsetInfo, action.payload.corpname);
                    }
                });
                (List.last(this.state.data[action.payload.sourceId].selHistory).length === 0 ?
                    this.loadInitialData(action.payload.sourceId) :
                    rxOf({
                        labels: [],
                        tags: []
                    })
                ).subscribe(
                    (data) => {
                        this.dispatchSideEffect<typeof Actions.GetInitialDataDone>({
                            name: Actions.GetInitialDataDone.name,
                            payload: {
                                tagsetId: this.tagsetId,
                                sourceId: action.payload.sourceId,
                                labels: data.labels,
                                tags: data.tags
                            }
                        });

                    },
                    (err) => {
                        this.dispatchSideEffect<typeof Actions.GetInitialDataDone>({
                            name: Actions.GetInitialDataDone.name,
                            payload: {
                                tagsetId: this.tagsetId,
                                sourceId: action.payload.sourceId,
                                labels: [],
                                tags: []
                            },
                            error: err
                        });
                    }
                );
            }
        );

        this.addActionHandler<typeof QueryActions.SetActiveInputWidget>(
            QueryActions.SetActiveInputWidget.name,
            action => {
                this.changeState(state => {
                    if (!Dict.hasKey(action.payload.sourceId, state.data)) {
                        state.data[action.payload.sourceId] = createEmptyPosTagsetStatus(
                                state.tagsetInfo, action.payload.corpname);
                    }
                    state.data[action.payload.sourceId].queryRange = action.payload.appliedQueryRange;
                });
            }
        );
    }


    private loadInitialData(sourceId:string):Observable<TagDataResponse> {
        return this.pluginApi.ajax$<TagDataResponse>(
            HTTP.Method.GET,
            this.pluginApi.createActionUrl(
                'corpora/ajax_get_tag_variants',
                [
                    ['corpname', this.state.data[sourceId].corpname],
                    ['tagset', this.state.tagsetInfo.ident]
                ]
            ),
            {}
        );
    }

    private updateData(sourceId:string):Observable<TagDataResponse> {
        return this.pluginApi.ajax$<TagDataResponse>(
            HTTP.Method.GET,
            this.pluginApi.createActionUrl(
                'corpora/ajax_get_tag_variants',
                [
                    ['corpname', this.state.data[sourceId].corpname],
                    ['tagset', this.state.tagsetInfo.ident],
                    ['pattern', this.state.data[sourceId].srchPattern]
                ]
            ),
            {}
        );
    }

    private resetSelections(state:PosTagModelState, sourceId:string):void {
        const data = state.data[sourceId];
        data.selHistory = data.selHistory.slice(0, 2);
        data.positions = List.last(data.selHistory);
        data.canUndo = this.canUndo(data);
        data.srchPattern = this.getCurrentPattern(data);
        [data.rawPattern, data.generatedQuery] = this.exportCurrentPattern(data);
    }

    private undo(state:PosTagModelState, sourceId:string):void {
        const data = state.data[sourceId];
        if (data.selHistory.length > 2) {
            data.selHistory = data.selHistory.slice(0, -1);
            data.positions = List.last(data.selHistory);
        }
        data.canUndo = this.canUndo(data);
        data.srchPattern = this.getCurrentPattern(data);
        [data.rawPattern, data.generatedQuery] = this.exportCurrentPattern(data);
    }

    /**
     * Try to parse preset pattern and check matching checkboxes
     * according to parsed values. This is used along with advanced
     * CQL editor.
     */
    private applyPresetPattern(state:PosTagModelState, sourceId:string):void {
        const data = state.data[sourceId];
        if (/^\||[^\\]\|/.exec(data.presetPattern)) {
            this.pluginApi.showMessage(
                'warning',
                this.pluginApi.translate('taghelper__cannot_parse')
            );
        }
        const parsePattern = /\[\\?[^\]]+\]|\\?[^\]^\[^\.]|\.\*|\./g;
        const values = [];
        let item = parsePattern.exec(data.presetPattern);
        while (item !== null) {
            values.push(List.head(item).substr(0, 1) === '[' ?
                List.head(item).substring(1, List.head(item).length - 1) : List.head(item));
            item = parsePattern.exec(data.presetPattern);
        }
        pipe(
            data.selHistory,
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
                    const lst = List.last(data.selHistory);
                    lst[i] = newPos;
                    data.selHistory.push(lst);
                }
            )
        );
        data.positions = List.last(data.selHistory);
        data.canUndo = false;
        data.srchPattern = this.getCurrentPattern(data);
        [data.rawPattern, data.generatedQuery] = this.exportCurrentPattern(data);
        data.presetPattern = null;
    }

    /**
     * Performs an initial import (i.e. any previous data is lost)
     */
    private importData(state:PosTagModelState, labels:Array<string>, rawData:RawTagValues, sourceId:string):void {
        const data = state.data[sourceId];
        data.selHistory.push(List.map(
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
            rawData
        ));
        data.positions = List.last(data.selHistory);
        data.canUndo = this.canUndo(data);
    }

    private hasSelectedItemsAt(opt:PositionOptions):boolean {
        return opt.values.some((item:PositionValue) => item.selected === true);
    }

    private hasSelectedItems(data:PosTagStatus):boolean {
        return pipe(
            data.selHistory,
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
    private mergeData(state:PosTagModelState, tags:RawTagValues, triggerRow:number, sourceId:string):void {
        const mappedTags = pipe(
            tags,
            List.map(Dict.fromEntries())
        );

        const data = state.data[sourceId];
        const newItem = pipe(
            data.selHistory,
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
        data.selHistory.pop();
        data.selHistory.push(newItem);
        data.positions = List.last(data.selHistory);
        data.canUndo = this.canUndo(data);
    }

    /**
     * Changes the 'checked' status of an item specified by a position and a value
     * (.e.g. 2nd position (gender), F value (feminine))
     */
    private updateSelectedItem(
        state:PosTagModelState,
        position:number,
        value:string,
        checked:boolean,
        sourceId:string
    ):void {
        const data = state.data[sourceId];
        const oldPos = List.last(data.selHistory)[position];
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
        const newSelection = cloneSelection(List.last(data.selHistory));
        newSelection[position] = newPos;
        data.selHistory.push(newSelection);
        data.srchPattern = this.getCurrentPattern(data);
        [data.rawPattern, data.generatedQuery] = this.exportCurrentPattern(data);
    }

    private canUndo(data:PosTagStatus):boolean {
        return data.selHistory.length > 2;
    }

    private getCurrentPattern(data:PosTagStatus):string {

        function exportPosition(v:Array<string>):string {
            if (v.length > 1) {
                return '[' + v.join('') + ']';

            } else if (v.length === 1) {
                return v[0];

            } else {
                return '.';
            }
        }
        if (this.hasSelectedItems(data)) {
            return pipe(
                data.selHistory,
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

    private exportCurrentPattern(data:PosTagStatus):[string, string] {
        const ans = this.getCurrentPattern(data).replace(/\.\.+$/,  '.*');
        return [ans, `${data.tagAttr}="${ans}"`];
    }

    /**
     * Return options for a selected position (e.g. position 2: M, I, F, N, X)
     */
    getOptions(data:PosTagStatus, position:number):PositionOptions {
        return List.last(data.selHistory)[position];
    }
}