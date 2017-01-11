/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
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

/// <reference path="../../types/common.d.ts" />

import * as Immutable from 'vendor/immutable';
import {SimplePageStore} from '../../util';
import {PageModel} from '../../tpl/document';


export type AttrItem = {n:string; label:string};

export interface SortFormProperties {
    attrList:Array<AttrItem>;
}

/**
 *
 */
export class SortStore extends SimplePageStore {

    private pageModel:PageModel;

    private availAttrList:Immutable.List<AttrItem>;

    private sattrValues:Immutable.Map<string, string>;

    private skeyValues:Immutable.Map<string, string>;

    private sposValues:Immutable.Map<string, string>;

    private sicaseValues:Immutable.Map<string, boolean>;

    private sbwardValues:Immutable.Map<string, boolean>;

    constructor(dispatcher:Dispatcher.Dispatcher<any>, pageModel:PageModel, props:SortFormProperties) {
        super(dispatcher);
        this.availAttrList = Immutable.List<AttrItem>(props.attrList);

        this.dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {

            }
        });
    }

    getAvailAttrs():Immutable.List<AttrItem> {
        return this.availAttrList;
    }
}


/**
 *
 */
export class MultiLevelSortStore extends SimplePageStore {

    private pageModel:PageModel;

    private availAttrList:Immutable.List<AttrItem>;

    private mlxattrValues:Immutable.Map<string, Immutable.List<string>>;

    private mlxicaseValues:Immutable.Map<string, Immutable.List<boolean>>;

    private mlxbwardValues:Immutable.Map<string, Immutable.List<boolean>>;

    private mlxctxValues:Immutable.Map<string, Immutable.List<string>>;

    constructor(dispatcher:Dispatcher.Dispatcher<any>, pageModel:PageModel, props:SortFormProperties) {
        super(dispatcher);
        this.availAttrList = Immutable.List<AttrItem>(props.attrList);

        this.dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {

            }

        });
    }

    getAvailAttrs():Immutable.List<AttrItem> {
        return this.availAttrList;
    }
}