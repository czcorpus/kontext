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

/// <reference path="../../vendor.d.ts/rsvp.d.ts" />

import {Kontext} from '../../types/common';
import {IPluginApi} from '../../types/plugins';
import {SimplePageStore} from '../../stores/base';
import * as Immutable from 'immutable';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';


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

/**
 * This store handles a single tag-builder instance.
 */
export class TagHelperStore extends SimplePageStore {

    static DispatchToken:string;

    private pluginApi:IPluginApi;

    private corpname:string;

    /**
     * Contains all the values (inner lists) along with selection
     * status through whole user interaction (outer list).
     */
    private data:Immutable.List<Immutable.List<PositionOptions>>;

    private presetPattern:string;

    private _isBusy:boolean;

    constructor(dispatcher:ActionDispatcher, pluginApi:IPluginApi, corpname:string) {
        super(dispatcher);
        this.pluginApi = pluginApi;
        this.corpname = corpname;
        this._isBusy = false;
        this.data = Immutable.List<Immutable.List<PositionOptions>>().push(Immutable.List<PositionOptions>());

        this.dispatcher.register((payload:ActionPayload) => {
                switch (payload.actionType) {
                    case 'TAGHELPER_PRESET_PATTERN':
                        this.presetPattern = payload.props['pattern'];
                        if (this.data.last().size > 0) {
                            this.applyPresetPattern();
                        }
                        this.notifyChangeListeners();
                    break;
                    case 'TAGHELPER_GET_INITIAL_DATA':
                        if (this.data.last().size === 0) {
                            this._isBusy = true;
                            this.notifyChangeListeners();
                        }
                    break;
                    case 'TAGHELPER_GET_INITIAL_DATA_DONE':
                        if (!payload.error) {
                            this.importData(payload.props['data'].labels, payload.props['data'].tags);
                            this._isBusy = false;
                            if (this.presetPattern) {
                                this.applyPresetPattern();
                            }

                        } else {
                            this.pluginApi.showMessage('error', payload.error);
                        }
                        this.notifyChangeListeners();
                    break;
                    case 'TAGHELPER_CHECKBOX_CHANGED':
                        this.updateSelectedItem(payload.props['position'], payload.props['value'],
                                payload.props['checked']);
                        this.notifyChangeListeners();
                    break;
                    case 'TAGHELPER_LOAD_FILTERED_DATA':
                        this._isBusy = true;
                        this.notifyChangeListeners();
                    break;
                    case 'TAGHELPER_LOAD_FILTERED_DATA_DONE':
                        this._isBusy = false;
                        if (!payload.error) {
                            this.mergeData(
                                payload.props['data'].tags,
                                payload.props['triggerRow']
                            );

                        } else {
                            this.pluginApi.showMessage('error', payload.error);
                        }
                        this.notifyChangeListeners();
                    break;
                    case 'TAGHELPER_UNDO':
                        if (this.data.size > 2) {
                            this.data = this.data.slice(0, -1).toList();
                            this.notifyChangeListeners();

                        } else {
                            throw new Error('Cannot undo. Already at the first item');
                        }
                    break;
                    case 'TAGHELPER_RESET':
                        this.resetSelections();
                        this.notifyChangeListeners();
                    break;
                }
            }
        );
    }

    private resetSelections():void {
        this.data = this.data.slice(0, 2).toList();
    }

    /**
     * Try to parse preset pattern and check matching checkboxes
     * according to parsed values. This is used along with advanced
     * CQL editor.
     */
    private applyPresetPattern():void {
        if (/^\||[^\\]\|/.exec(this.presetPattern)) {
            this.pluginApi.showMessage('warning', this.pluginApi.translate('taghelper__cannot_parse'));
        }
        const parsePattern = /\[[^\]]+\]|[^\]^\[^\.]|\./g;
        const values = [];
        let item = null;
        while ((item = parsePattern.exec(this.presetPattern)) !== null) {
            values.push(item[0].substr(0, 1) === '[' ? item[0].substring(1, item[0].length - 1) : item[0]);
        }
        for (let i = 0; i < this.data.last().size; i +=1 ) {
            const oldPos = this.data.last().get(i);
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
            this.data = this.data.push(this.data.last().set(i, newPos));
        }
        this.presetPattern = null;
    }

    /**
     * Performs an initial import (i.e. any previous data is lost)
     */
    private importData(labels:Array<string>, data:RawTagValues):void {
        this.data = this.data.push(Immutable.List<PositionOptions>(
                data.map<PositionOptions>((position:Array<Array<string>>, i:number) => {
                    let posOpts:PositionOptions = {
                        label: labels[i],
                        values: null,
                        locked: false
                    };
                    posOpts.values = Immutable.List<PositionValue>(position.map<PositionValue>((item: Array<string>) => {
                        return {
                            id: item[0],
                            title: item[1],
                            selected: false,
                            available: true
                        };
                    }));
                    return posOpts;
                })
            )
        );
    }

    private hasSelectedItemsAt(opt:PositionOptions):boolean {
        return opt.values.some((item:PositionValue) => item.selected === true);
    }

    private hasSelectedItems():boolean {
        return this.data.last()
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
    private mergeData(data:UpdateTagValues, triggerRow:number):void {
        const newItem = this.data.last().map((item:PositionOptions, i:number) => {
            let newItem:PositionOptions;

            if (!item.locked && this.hasSelectedItemsAt(item) && i !== triggerRow) {
                newItem = {
                    label: item.label,
                    values: item.values,
                    locked: true
                };

            } else if (i !== triggerRow && !item.locked) {
                const tmp = Immutable.Map(data[i]);
                newItem = {
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
                newItem = item;
            }
            return newItem;
        }).toList();
        this.data = this.data.pop().push(newItem);
    }

    /**
     * Changes the 'checked' status of an item specified by a position and a value
     * (.e.g. 2nd position (gender), F value (feminine))
     */
    private updateSelectedItem(position:number, value:string, checked:boolean):void {
        const oldPos = this.data.last().get(position);
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
        this.data = this.data.push(this.data.last().set(position, newPos));
    }

    /**
     * Update existing data from server based on the current
     * tag pattern.
     */
    private updateData(triggerRow:number):RSVP.Promise<any> {
        let pattern:string = this.getCurrentPattern();
        let prom:RSVP.Promise<TagDataResponse> = this.pluginApi.ajax<TagDataResponse>(
            'GET',
            this.pluginApi.createActionUrl('corpora/ajax_get_tag_variants'),
            { corpname: this.pluginApi.getConf('corpname'), pattern: pattern }
        );
        return prom.then(
            (data) => {
                this.mergeData(data.tags, triggerRow);
                return data;
            },
            (err) => {
                this.pluginApi.showMessage('error', err);
            }
        );
    }

    getCurrentPattern():string {
        function exportPosition(v) {
            if (v.size > 1) {
                return '[' + v.join('') + ']';

            } else if (v.size === 1) {
                return v.join('');

            } else {
                return '.';
            }
        }
        if (this.hasSelectedItems()) {
            return this.data.last().map<string>((item:PositionOptions) => {
                return exportPosition(item.values
                            .filter((s:PositionValue) => s.selected)
                            .map<string>((s:PositionValue) => s.id)
                );
            }).join('');

        } else {
            return '.*';
        }
    }

    exportCurrentPattern():string {
        return this.getCurrentPattern().replace(/\.\.+$/,  '.*');
    }

    /**
     * Return options for a selected position (e.g. position 2: M, I, F, N, X)
     */
    getOptions(position:number):PositionOptions {
        return this.data.last().get(position);
    }

    getPositions():Immutable.List<PositionOptions> {
        return this.data.last();
    }

    /**
     * Return an unique state identifier
     */
    getStateId():string {
        return this.data.last().map<string>((item:PositionOptions) => {
            let ans = item.values.filter((s:PositionValue) => s.selected)
                    .map<string>((s:PositionValue) => s.id);
            return ans.size > 0 ? '[' + ans.join('') + ']' : ''
        }).join('');
    }

    isBusy():boolean {
        return this._isBusy;
    }

    canUndo():boolean {
        return this.data.size > 2;
    }

    getCorpname():string {
        return this.corpname;
    }
}