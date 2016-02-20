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

interface TagDataResponse {
    containsErrors:boolean;
    messages:Array<string>;
    labels:Array<string>;
    tags:RawTagValues;
}

export interface PositionValue {
    id:string;
    title:string;
    selected:boolean;
    available:boolean;
}

export interface PositionOptions {
    label:string;
    values:Immutable.List<PositionValue>;
    locked:boolean;
}

/**
 * This store handles corplist 'filter' form
 */
export class TagHelperStore extends util.SimplePageStore {

    static DispatchToken:string;

    protected pluginApi:Kontext.PluginApi;

    private data:Immutable.List<PositionOptions>;

    constructor(pluginApi:Kontext.PluginApi) {
        super(pluginApi.dispatcher());
        var self = this;
        this.pluginApi = pluginApi;
        this.data = Immutable.List<PositionOptions>();

        TagHelperStore.DispatchToken = this.dispatcher.register(
            function (payload:Kontext.DispatcherPayload) {
                switch (payload.actionType) {
                    case 'TAGHELPER_GET_INITIAL_DATA':
                        self.loadInitialData();
                        break;
                    case 'TAGHELPER_CHECKBOX_CHANGED':
                        self.updateSelectedItem(payload.props['position'], payload.props['value'], payload.props['checked']);
                        self.updateData(payload.props['position']).then(
                            (data) => {
                                self.notifyChangeListeners('TAGHELPER_UPDATED_DATA_RECEIVED');
                            },
                            (err) => {
                                console.log('err ', err); // TODO
                            }
                        );
                        break;
                }
            }
        );
    }

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

    private mergeData(data:UpdateTagValues, triggerRow:number):void {
        this.data.forEach((item:PositionOptions, i:number) => {
            if (!item.locked && this.hasSelectedItems(item) && i !== triggerRow) {
                item.locked = true;

            } else if (i !== triggerRow && !item.locked) {
                let tmp = Immutable.Map(data[i]);
                item.values.filter(v => v.id !== '-').forEach((item:PositionValue) => {
                    if (tmp.get(item.id) === undefined) {
                        item.available = false;

                    } else if (item.available === false) {
                        item.available = true;
                    }
                });
            }
        });
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
                    console.log('err: ', data.messages.join(', ')); // TODO
                }
            },
            (err) => {
                console.log('err: ', err);
                // TODO
            }
        );
    }

    private updateSelectedItem(position:number, value:string, checked:boolean):void {
        this.data.get(position).values
                .filter((item:PositionValue) => item.id === value)
                    .forEach((item:PositionValue) => item.selected = checked);
    }

    private updateData(triggerRow:number):RSVP.Promise<any> {
        let pattern:string = this.exportRegexp();
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
                    console.log('err: ', data.messages.join(', ')); // TODO
                }
            },
            (err) => {
                console.log('err: ', err);
                // TODO
            }
        );
    }

    private exportRegexp():string {
        return this.data.map<string>((item:PositionOptions) => {
            let ans = item.values.filter((s:PositionValue) => s.selected)
                    .map<string>((s:PositionValue) => s.id);
            return ans.size > 0 ? '[' + ans.join('') + ']' : '-'
        }).join('');
    }

    getOptions(position:number):PositionOptions {
        return this.data.get(position);
    }

    getPositions():Immutable.List<PositionOptions> {
        return this.data;
    }
}