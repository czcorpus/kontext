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


import util = require('../../util');


export interface TagData {

}


/**
 * This store handles corplist 'filter' form
 */
export class TagHelperStore extends util.SimplePageStore {

    protected pluginApi:Kontext.PluginApi;

    static DispatchToken:string;

    constructor(pluginApi:Kontext.PluginApi) {
        super(pluginApi.dispatcher());
        var self = this;
        this.pluginApi = pluginApi;

        TagHelperStore.DispatchToken = this.dispatcher.register(
            function (payload:Kontext.DispatcherPayload) {
                switch (payload.actionType) {
                    case 'TAGHELPER_GET_INITIAL_DATA':
                        console.log('TagHelperStore received TAGHELPER_GET_INITIAL_DATA');
                        self.loadInitialData();
                        break;
                }
            }
        );
    }


    private loadInitialData() {
        let prom:RSVP.Promise<TagData> = this.pluginApi.ajax<TagData>(
            'GET',
            this.pluginApi.createActionUrl('corpora/ajax_get_tag_variants'),
            { corpname: this.pluginApi.getConf('corpname') },
            { contentType : 'application/x-www-form-urlencoded' }
        );
        prom.then(
            (data) => {
                console.log(data);
                this.notifyChangeListeners('TAGHELPER_INITIAL_DATA_RECEIVED');
            },
            (err) => {
                console.log('err: ', err);
                // TODO
            }
        )
    }
}