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


/// <reference path="../../../ts/declarations/rsvp.d.ts" />
/// <reference path="../../../ts/declarations/immutable.d.ts" />


import util = require('../../util');
import Immutable = require('vendor/immutable');


type RawTagValues = Array<Array<Array<string>>>;

type UpdateTagValues = {[idx:number]:Array<Array<string>>};

/**
 * Defines a JSON format used by server
 */
interface TagDataResponse {
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
export class TagHelperStore extends util.SimplePageStore {

    static DispatchToken:string;

    protected pluginApi:Kontext.PluginApi;

    private data:Immutable.List<PositionOptions>;

    private widgetId:number;

    constructor(pluginApi:Kontext.PluginApi, widgetId:number) {
        super(pluginApi.dispatcher());
        var self = this;
        this.pluginApi = pluginApi;
        this.widgetId = widgetId;
        this.data = Immutable.List<PositionOptions>();

        TagHelperStore.DispatchToken = this.dispatcher.register(
            function (payload:Kontext.DispatcherPayload) {
                if (self.widgetId === payload.props['widgetId']) {
                    switch (payload.actionType) {
                        case 'TAGHELPER_GET_INITIAL_DATA':
                            self.loadInitialData();
                            break;
                        case 'TAGHELPER_CHECKBOX_CHANGED':
                            self.updateSelectedItem(payload.props['position'], payload.props['value'],
                                    payload.props['checked']);
                            self.notifyChangeListeners('TAGHELPER_PATTERN_CHANGED');
                            self.updateData(payload.props['position']).then(
                                (data) => {
                                    if (!data['containsErrors']) {
                                        self.notifyChangeListeners('TAGHELPER_UPDATED_DATA_CHANGED');

                                    } else {
                                        self.pluginApi.showMessage('error', data['messages'].join(', '));
                                    }
                                },
                                (err) => {
                                    self.pluginApi.showMessage('error', err);
                                }
                            );
                            break;
                        case 'TAGHELPER_RESET':
                            self.resetSelections();
                            self.notifyChangeListeners('TAGHELPER_UPDATED_DATA_CHANGED');
                            self.notifyChangeListeners('TAGHELPER_PATTERN_CHANGED');
                            break;
                        case 'TAGHELPER_INSERT_TAG':
                            self.notifyChangeListeners('TAGHELPER_INSERT_TAG_ACKOWLEDGED');
                            break;
                    }
                }
            }
        );
    }

    private resetSelections():void {
        this.data = this.data.map((item:PositionOptions) => {
            return {
                label: item.label,
                locked: false,
                values: item.values.map((v:PositionValue) => {
                    return {
                        id: v.id,
                        title: v.title,
                        selected: false,
                        available: true
                    };
                }).toList()
            };
        }).toList();
    }

    /**
     * Performs an initial import (i.e. any previous data is lost)
     */
    private importData(labels:Array<string>, data:RawTagValues):void {
        this.data = Immutable.List<PositionOptions>(data.map<PositionOptions>((position:Array<Array<string>>, i:number) => {
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
        }));
    }

    private hasSelectedItems(opt:PositionOptions):boolean {
        return opt.values.some((item:PositionValue) => item.selected === true);
    }

    /**
     * Merges data from server (generated by the current tag pattern) with
     * the current data. This actually means several things:
     * 1) any unlocked block with selected items and different than the
     *    current one is locked
     * 2) any position option value not found in server response is made unavalilable
     */
    private mergeData(data:UpdateTagValues, triggerRow:number):void {
        this.data = this.data.map((item:PositionOptions, i:number) => {
            let newItem:PositionOptions;

            if (!item.locked && this.hasSelectedItems(item) && i !== triggerRow) {
                newItem = {
                    label: item.label,
                    values: item.values,
                    locked: true
                };

            } else if (i !== triggerRow && !item.locked) {
                let tmp = Immutable.Map(data[i]);
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
    }


    private loadInitialData():void {
        let prom:RSVP.Promise<TagDataResponse> = this.pluginApi.ajax<TagDataResponse>(
            'GET',
            this.pluginApi.createActionUrl('corpora/ajax_get_tag_variants'),
            { corpname: this.pluginApi.getConf('corpname') },
            { contentType : 'application/x-www-form-urlencoded' }
        );
        prom.then(
            (data) => {
                if (!data.containsErrors) {
                    this.importData(data.labels, data.tags);
                    this.notifyChangeListeners('TAGHELPER_INITIAL_DATA_RECEIVED');

                } else {
                    this.pluginApi.showMessage('error', data.messages.join(', '));
                }
            },
            (err) => {
                this.pluginApi.showMessage('error', err);
            }
        );
    }

    /**
     * Changes the 'checked' status of an item specified by a position and a value
     * (.e.g. 2nd position (gender), F value (feminine))
     */
    private updateSelectedItem(position:number, value:string, checked:boolean):void {
        let oldPos = this.data.get(position);
        let newPos:PositionOptions = {
            label: oldPos.label,
            values: oldPos.values.map((item:PositionValue) => {
                return {
                    id: item.id,
                    title: item.title,
                    selected: item.id === value ? true : item.selected,
                    available: item.available
                }
            }).toList(),
            locked: oldPos.locked
        };
        this.data = this.data.set(position, newPos);
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
            { corpname: this.pluginApi.getConf('corpname'), pattern: pattern },
            { contentType : 'application/x-www-form-urlencoded' }
        );
        return prom.then(
            (data) => {
                if (!data.containsErrors) {
                    this.mergeData(data.tags, triggerRow);

                } else {
                    this.pluginApi.showMessage('error', data.messages.join(', '));
                }
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
        return this.data.map<string>((item:PositionOptions) => {
            return exportPosition(item.values
                    .filter((s:PositionValue) => s.selected)
                        .map<string>((s:PositionValue) => s.id));
        }).join('');
    }

    exportCurrentPattern():string {
        return this.getCurrentPattern().replace(/\.\.+$/,  '.*');
    }

    /**
     * Return options for a selected position (e.g. position 2: M, I, F, N, X)
     */
    getOptions(position:number):PositionOptions {
        return this.data.get(position);
    }

    getPositions():Immutable.List<PositionOptions> {
        return this.data;
    }

    /**
     * Return an unique state identifier
     */
    getStateId():string {
        return this.data.map<string>((item:PositionOptions) => {
            let ans = item.values.filter((s:PositionValue) => s.selected)
                    .map<string>((s:PositionValue) => s.id);
            return ans.size > 0 ? '[' + ans.join('') + ']' : ''
        }).join('');
    }
}