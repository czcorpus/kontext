/*
 * Copyright (c) 2018 Institute of the Czech National Corpus
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

import {Kontext} from '../../types/common';
import {ActionDispatcher} from '../../app/dispatcher';
import {IPluginApi} from '../../types/plugins';
import {TagDataResponse, TagHelperStore} from './stores';

export class TagHelperActions {

    private dispatcher:ActionDispatcher;

    private pluginApi:IPluginApi;

    private store:TagHelperStore;

    constructor(dispatcher:ActionDispatcher, pluginApi:IPluginApi, store:TagHelperStore) {
        this.dispatcher = dispatcher;
        this.pluginApi = pluginApi;
        this.store = store;
    }


    private loadInitialData():RSVP.Promise<TagDataResponse> {
        return this.pluginApi.ajax<TagDataResponse>(
            'GET',
            this.pluginApi.createActionUrl('corpora/ajax_get_tag_variants'),
            { corpname: this.pluginApi.getConf('corpname') }
        );
    }

    private loadFilteredData(pattern:string, corpname:string):RSVP.Promise<any> {
        return this.pluginApi.ajax<TagDataResponse>(
            'GET',
            this.pluginApi.createActionUrl('corpora/ajax_get_tag_variants'),
            {
                corpname: corpname,
                pattern: pattern
            }
        );
    }

    taghelperReset():void {
        this.dispatcher.dispatch({
            actionType: 'TAGHELPER_RESET',
            props: {}
        });
    }

    taghelperUndo():void {
        this.dispatcher.dispatch({
            actionType: 'TAGHELPER_UNDO',
            props: {}
        });
    }

    injectQuery(sourceId:string, queryChunk:string, range:[number, number]):void {
        this.dispatcher.dispatch({
            actionType: 'CQL_EDITOR_SET_RAW_QUERY',
            props: {
                sourceId: sourceId,
                query: queryChunk,
                range: range
            }
        });
    }

    appendQuery(sourceId:string, queryChunk:string):void {
        this.dispatcher.dispatch({
            actionType: 'QUERY_INPUT_APPEND_QUERY',
            props: {
                sourceId: sourceId,
                query: queryChunk
            }
        });
    }

    checkboxChanged(lineIdx:number, value:string, checked:boolean, corpusId:string):void {
        this.dispatcher.dispatch({
            actionType: 'TAGHELPER_CHECKBOX_CHANGED',
            props: {
                position: lineIdx,
                value: value,
                checked: checked
            }
        });
        const srchPattern = this.store.getCurrentPattern();
        this.dispatcher.dispatch$(action => {
            action.next({
                actionType: 'TAGHELPER_LOAD_FILTERED_DATA',
                props: {}
            });
            this.loadFilteredData(srchPattern, corpusId).then(
                (data) => {
                    action.next({
                        actionType: 'TAGHELPER_LOAD_FILTERED_DATA_DONE',
                        props: {
                            position: lineIdx,
                            data: data
                        }
                    });
                },
                (err) => {
                    action.next({
                        actionType: 'TAGHELPER_LOAD_FILTERED_DATA_DONE',
                        props: {},
                        error: err
                    });
                }
            );
        });
    }


    getInitialData():void {
        this.dispatcher.dispatch$(action => {
            action.next({
                actionType: 'TAGHELPER_GET_INITIAL_DATA',
                props: {}
            });
            this.loadInitialData().then(
                (data) => {
                    action.next({
                        actionType: 'TAGHELPER_GET_INITIAL_DATA_DONE',
                        props: {
                            data: data
                        }
                    });
                },
                (err) => {
                    action.next({
                        actionType: 'TAGHELPER_GET_INITIAL_DATA_DONE',
                        props: {},
                        error: err
                    });
                }
            );
        });
    }
}