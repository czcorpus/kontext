/*
 * Copyright (c) 2018 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

/// <reference path="../../../types/common.d.ts" />
/// <reference path="../../../vendor.d.ts/immutable.d.ts" />

import * as Immutable from 'vendor/immutable';
import {SimplePageStore} from '../../../stores/base';
import {GeneralQueryStore} from '../main';
import {PageModel} from '../../../app/main';
import {AttrHelper} from './attrs';
import {highlightSyntax} from './main';


export class CQLEditorStore extends SimplePageStore {

    private pageModel:PageModel;

    private rawCode:Immutable.Map<string, string>;

    private richCode:Immutable.Map<string, string>;

    private attrList:Immutable.List<Kontext.AttrItem>;

    private structAttrList:Immutable.List<Kontext.AttrItem>;

    private tagAttr:string;

    private attrHelper:AttrHelper;

    private onContentChangeListeners:Immutable.List<(sId:string, s:string)=>void>;

    private hintListeners:Immutable.Map<string, (msg:string)=>void>;

    private message:Immutable.Map<string, string>;

    private queryStore:GeneralQueryStore;

    constructor(dispatcher:Kontext.FluxDispatcher, pageModel:PageModel, queryStore:GeneralQueryStore,
            attrList:Array<Kontext.AttrItem>, structAttrList:Array<Kontext.AttrItem>, tagAttr:string) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.queryStore = queryStore;
        this.attrList = Immutable.List<Kontext.AttrItem>(attrList);
        this.structAttrList = Immutable.List<Kontext.AttrItem>(structAttrList);
        this.tagAttr = tagAttr;
        this.rawCode = Immutable.Map<string, string>();
        this.richCode = Immutable.Map<string, string>();
        this.attrHelper = new AttrHelper(this.attrList, this.structAttrList, this.tagAttr);
        this.onContentChangeListeners = Immutable.List<(sId:string, s:string)=>void>();
        this.message = Immutable.Map<string, string>();
        this.hintListeners = Immutable.Map<string, (msg:string)=>void>();
        this.syncWithQueryStore = this.syncWithQueryStore.bind(this);

        this.rawCode.forEach((query, sourceId) => {
            this.hintListeners = this.hintListeners.set(
                sourceId,
                (msg:string) => {
                    this.message = this.message.set(sourceId, msg);
                }
            );
            this.richCode = this.richCode.set(
                sourceId,
                highlightSyntax(
                    query,
                    'cql',
                    this.pageModel.getComponentHelpers(),
                    this.attrHelper,
                    this.hintListeners.get(sourceId)
                )
            );
        });

        dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'CQL_EDITOR_SET_RAW_QUERY':
                    this.setRawQuery(
                        <string>payload.props['sourceId'],
                        <string>payload.props['query'],
                        <[number, number]>payload.props['range']
                    );
                    this.notifyChangeListeners();
                break;
                case 'QUERY_INPUT_SET_QUERY':
                case 'FILTER_QUERY_INPUT_SET_QUERY':
                    dispatcher.waitFor([this.queryStore.getDispatcherToken()]);
                    const sourceId = <string>payload.props['sourceId'];
                    if (!this.rawCode.has(sourceId)) {
                        this.rawCode = this.rawCode.set(sourceId, '');
                    }
                    this.setRawQuery(
                        sourceId,
                        <string>payload.props['query'],
                        [0, this.rawCode.get(sourceId).length]
                    );
                    this.notifyChangeListeners();

                break;
                case 'QUERY_INPUT_APPEND_QUERY':
                case 'FILTER_QUERY_INPUT_APPEND_QUERY':
                    dispatcher.waitFor([this.queryStore.getDispatcherToken()]);
                    const sourceId2 = <string>payload.props['sourceId'];
                    if (!this.rawCode.has(sourceId2)) {
                        this.rawCode = this.rawCode.set(sourceId2, '');
                    }
                    this.setRawQuery(
                        sourceId2,
                        <string>payload.props['query'],
                        [0, null]
                    );
                    this.notifyChangeListeners();
                break;
            }
        });
    }

    /**
     *
     * @param sourceId
     * @param query
     * @param range
     */
    private setRawQuery(sourceId:string, query:string, range:[number, number]):void {
        let newQuery:string;

        if (Array.isArray(range) && range[1] === null) {
            newQuery = this.rawCode.get(sourceId) + query;

        } else if (Array.isArray(range)) {
            newQuery = this.rawCode.get(sourceId).substring(0, range[0]) + query +
                    this.rawCode.get(sourceId).substr(range[1]);

        } else {
            newQuery = query;
        }

        this.rawCode = this.rawCode.set(
            sourceId,
            newQuery
        );

        if (!this.hintListeners.has(sourceId)) {
            this.hintListeners = this.hintListeners.set(
                sourceId,
                (msg:string) => {
                    this.message = this.message.set(sourceId, msg);
                }
            );
        }

        this.onContentChangeListeners.forEach(fn => fn(
            sourceId, newQuery));

        this.richCode = this.richCode.set(
            sourceId,
            highlightSyntax(
                this.rawCode.get(sourceId),
                'cql',
                this.pageModel.getComponentHelpers(),
                this.attrHelper,
                this.hintListeners.get(sourceId)
            )
        );
    }

    syncWithQueryStore():void {
        const queries = this.queryStore.getQueries();
        const qTypes = this.queryStore.getQueryTypes();
        queries.forEach((v, k) => {
            if (qTypes.get(k) === 'cql') {
                this.rawCode = this.rawCode.set(k, '');
                this.setRawQuery(k, v, [0, 0]);
            }
        });
    }

    getRawCode(sourceId:string):string {
        return this.rawCode.get(sourceId);
    }

    getRichCode(sourceId:string):string {
        return this.richCode.get(sourceId);
    }

    getMessage(sourceId:string):string {
        return this.message.get(sourceId);
    }

    addOnContentChangeListener(fn:(sourceId:string, rawQuery:string)=>void):void {
        this.onContentChangeListeners = this.onContentChangeListeners.push(fn);
    }

}