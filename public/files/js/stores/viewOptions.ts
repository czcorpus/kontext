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

/// <reference path="../types/common.d.ts" />
/// <reference path="../../ts/declarations/flux.d.ts" />
/// <reference path="../../ts/declarations/immutable.d.ts" />

import {SimplePageStore} from '../util';
import Immutable = require('vendor/immutable');



export class ViewOptionsStore extends SimplePageStore implements ViewOptions.IViewOptionsStore {

    private attrList:Immutable.List<ViewOptions.AttrDesc>;

    private structList:Immutable.List<ViewOptions.StructDesc>;

    private structAttrs:ViewOptions.AvailStructAttrs;

    private fixedAttr:string;

    private hasLoadedData:boolean = false;


    constructor(dispatcher:Dispatcher.Dispatcher<any>) {
        super(dispatcher);
        const self = this;

        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            switch (payload.actionType) {
                case 'VIEW_OPTIONS_SET_ATTRIBUTE':
                    self.toggleAttribute(payload.props['idx']);
                    self.notifyChangeListeners();
                break;
                case 'VIEW_OPTIONS_SET_STRUCTURE':
                    self.toggleStructure(payload.props['structIdent'],
                        payload.props['structAttrIdent']);
                    self.notifyChangeListeners();
                break;
                case 'VIEW_OPTIONS_SET_REFERENCE':

                break;
            }
        });
    }

    private toggleAttribute(idx:number):void {
        const currItem = this.attrList.get(idx);
        const newItem = {
            n: currItem.n,
            label: currItem.label,
            locked: currItem.locked,
            selected: !currItem.selected
        }
        this.attrList.set(idx, newItem);
    }

    private hasSelectedStructAttrs(structIdent:string):boolean {
        return this.structAttrs.get(structIdent).find(item => item.selected) !== undefined;
    }

    private clearStructAttrSelection(structIdent:string):void {
        this.structAttrs = this.structAttrs.set(
                structIdent,
                this.structAttrs.get(structIdent).map(item => {
                    return {
                        n: item.n,
                        selected: false
                    };
                }).toList()
        );
    }


    private toggleStructure(structIdent:string, structAttrIdent:string):void {
        const struct = this.structList.find(item => item.n == structIdent);

        if (!struct) {
            throw new Error('structure not found: ' + structIdent);
        }

        const structIdx = this.structList.indexOf(struct);
        if (structAttrIdent !== null) {
            const currStructAttrs = this.structAttrs.get(structIdent);
            const currStructAttr = currStructAttrs.find(item => item.n === structAttrIdent);
            let structAttrIdx;

            if (currStructAttr) {
                structAttrIdx = currStructAttrs.indexOf(currStructAttr);
                const newStructAttrs = currStructAttrs.set(
                    structAttrIdx,
                    {
                        n: currStructAttr.n,
                        selected: !currStructAttr.selected
                    }
                );
                this.structAttrs = this.structAttrs.set(structIdent, newStructAttrs);
            }

            if (structAttrIdx !== undefined) {
                let tmp = this.structAttrs.get(structIdent).get(structAttrIdx).selected;
                let sel;

                if (tmp) {
                    sel = true;

                } else {
                    sel = this.hasSelectedStructAttrs(structIdent);
                }

                this.structList = this.structList.set(structIdx, {
                    label: struct.label,
                    n: struct.n,
                    locked: struct.locked,
                    selected: sel
                });
            }

        } else {
            if (struct.selected) {
                this.clearStructAttrSelection(structIdent);
            }
            this.structList = this.structList.set(structIdx, {
                label: struct.label,
                n: struct.n,
                locked: struct.locked,
                selected: !struct.selected
            });
        }
    }


    initFromPageData(data:ViewOptions.PageData):void {
        this.attrList = Immutable.List(data.AttrList.map(item => {
            return {
                label: item.label,
                n: item.n,
                selected: data.CurrentAttrs.indexOf(item.n) > -1 ? true : false,
                locked: item.n === data.FixedAttr ? true : false
            };
        }));
        this.structList = Immutable.List(data.AvailStructs.map(item => {
            return {
                label: item.label,
                n: item.n,
                selected: item.sel === 'selected' ? true : false,
                locked: false
            };
        }));

        this.structAttrs = Immutable.Map<string, Immutable.List<ViewOptions.StructAttrDesc>>(
            Object.keys(data.StructAttrs).map(key => {
                    return [
                        key,
                        Immutable.List(data.StructAttrs[key].map(structAttr => {
                            return {
                                n: structAttr,
                                selected: data.CurrStructAttrs.indexOf(key + '.' + structAttr) > -1 ? true : false
                            };
                        }))
                    ];
            })
        );

        this.fixedAttr = data.FixedAttr;
        this.hasLoadedData = true;
    }

    loadData():void {
        // ajax loading - TODO
    }

    isLoaded():boolean {
        return this.hasLoadedData;
    }


    getAttributes():Immutable.List<ViewOptions.AttrDesc> {
        return this.attrList;
    }

    getStructures():Immutable.List<ViewOptions.StructDesc> {
        return this.structList;
    }

    getStructAttrs():ViewOptions.AvailStructAttrs {
        return this.structAttrs;
    }

    getFixedAttr():string {
        return this.fixedAttr;
    }


}