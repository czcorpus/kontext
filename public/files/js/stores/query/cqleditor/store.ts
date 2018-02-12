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
import {PageModel} from '../../../app/main';
import {AttrHelper} from './attrs';
import {highlightSyntax} from './main';
import { init } from 'views/query/history';

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

    constructor(dispatcher:Kontext.FluxDispatcher, pageModel:PageModel, attrList:Array<Kontext.AttrItem>,
            structAttrList:Array<Kontext.AttrItem>, tagAttr:string, initialQueries?:{[sourceId:string]:string}) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.attrList = Immutable.List<Kontext.AttrItem>(attrList);
        this.structAttrList = Immutable.List<Kontext.AttrItem>(structAttrList);
        this.tagAttr = tagAttr;
        this.rawCode = Immutable.Map<string, string>(initialQueries || {});
        this.richCode = Immutable.Map<string, string>();
        this.attrHelper = new AttrHelper(this.attrList, this.structAttrList, this.tagAttr);
        this.onContentChangeListeners = Immutable.List<(sId:string, s:string)=>void>();
        this.message = Immutable.Map<string, string>();
        this.hintListeners = Immutable.Map<string, (msg:string)=>void>();

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
                    const sourceId:string = <string>payload.props['sourceId'];
                    const range:[number, number] = <[number, number]>payload.props['range'];

                    let newQuery:string;

                    if (Array.isArray(range) && range[1] === null) {
                        newQuery = this.rawCode.get(sourceId) + payload.props['query'];

                    } else if (Array.isArray(range)) {
                        newQuery = this.rawCode.get(sourceId).substring(0, range[0]) + payload.props['query'] +
                                this.rawCode.get(sourceId).substr(range[1]);

                    } else {
                        newQuery = payload.props['query'];
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
                    this.notifyChangeListeners();
                break;
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