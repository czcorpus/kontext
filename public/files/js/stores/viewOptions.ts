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
/// <reference path="../../ts/declarations/rsvp.d.ts" />

import {SimplePageStore} from '../util';
import Immutable = require('vendor/immutable');
import {PageModel} from '../tpl/document';
import RSVP = require('vendor/rsvp');



export class ViewOptionsStore extends SimplePageStore implements ViewOptions.IViewOptionsStore {

    private layoutModel:PageModel;

    private attrList:Immutable.List<ViewOptions.AttrDesc>;

    private selectAllAttrs:boolean = false;

    private structList:Immutable.List<ViewOptions.StructDesc>;

    private structAttrs:ViewOptions.AvailStructAttrs;

    private fixedAttr:string;

    private referenceList:Immutable.List<ViewOptions.RefsDesc>;

    private selectAllReferences:boolean = false;

    private hasLoadedData:boolean = false;


    constructor(layoutModel:PageModel, dispatcher:Dispatcher.Dispatcher<any>) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        const self = this;

        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            switch (payload.actionType) {
                case 'VIEW_OPTIONS_LOAD_DATA':
                    self.loadData().then(
                        (data) => {
                            self.hasLoadedData = true;
                            self.notifyChangeListeners();
                        },
                        (err) => {
                            this.layoutModel.showMessage('error', err);
                        }
                    );
                break;
                case 'VIEW_OPTIONS_TOGGLE_ATTRIBUTE':
                    self.toggleAttribute(payload.props['idx']);
                    self.notifyChangeListeners();
                break;
                case 'VIEW_OPTIONS_TOGGLE_ALL_ATTRIBUTES':
                    self.toggleAllAttributes();
                    self.notifyChangeListeners();
                break;
                case 'VIEW_OPTIONS_TOGGLE_STRUCTURE':
                    self.toggleStructure(payload.props['structIdent'],
                        payload.props['structAttrIdent']);
                    self.notifyChangeListeners();
                break;
                case 'VIEW_OPTIONS_TOGGLE_REFERENCE':
                    self.toggleReference(payload.props['idx']);
                    self.notifyChangeListeners();
                break;
                case 'VIEW_OPTIONS_TOGGLE_ALL_REFERENCES':
                    self.toggleAllReferences();
                    self.notifyChangeListeners();
                break;
                case 'VIEW_OPTIONS_SAVE_SETTINGS':
                    self.saveSettings().then(
                        (data) => {
                            self.notifyChangeListeners();
                        },
                        (err) => {
                            self.layoutModel.showMessage('error', err);
                        }
                    );
                break;
            }
        });
    }

    private serialize():any {
        // m.map((v, k) => v.map(x => k + '.' + x)).valueSeq().flatMap(x => x)
        const ans = {
            setattrs: this.attrList.filter(item => item.selected).map(item => item.n).toArray(),
            setstructs: this.structList.filter(item => item.selected).map(item => item.n).toArray(),
            structattrs: this.structAttrs
                            .map((v, k) => v.filter(x => x.selected))
                            .map((v, k) => v.map(x => [k, x]))
                            .valueSeq()
                            .flatMap(x => x)
                            .toArray(),
            setrefs: this.referenceList.filter(item => item.selected).map(item => item.n).toArray()
        };

        return ans;
    }

    private saveSettings():RSVP.Promise<any> {
        /*
        console.log('serialized: ', this.serialize());
        return new RSVP.Promise((resolve:()=>void, reject) => {
            resolve();
        });
        */

        return this.layoutModel.ajax(
            'POST',
            this.layoutModel.createActionUrl('options/viewattrsx'),
            this.serialize(),
            {contentType : 'application/x-www-form-urlencoded'}
        );
    }

    private toggleAllAttributes():void {
        this.selectAllAttrs = !this.selectAllAttrs;
        this.attrList = this.attrList.map(item => {
            return {
                n: item.n,
                label: item.label,
                locked: item.locked,
                selected: this.selectAllAttrs
            }
        }).toList();
    }

    private toggleAllReferences():void {
        this.selectAllReferences = !this.selectAllReferences;
        this.referenceList = this.referenceList.map(item => {
            return {
                n: item.n,
                label: item.label,
                selected: this.selectAllReferences
            }
        }).toList();
    }

    private toggleReference(idx:number):void {
        const currItem = this.referenceList.get(idx);
        this.referenceList = this.referenceList.set(idx, {
            label: currItem.label,
            n: currItem.n,
            selected: !currItem.selected
        });
        this.selectAllReferences = false;
    }

    private toggleAttribute(idx:number):void {
        const currItem = this.attrList.get(idx);
        this.attrList = this.attrList.set(idx, {
            n: currItem.n,
            label: currItem.label,
            locked: currItem.locked,
            selected: !currItem.selected
        });
        this.selectAllAttrs = false;
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

    /**
     * Change state of struct and/or structattr. The rules are following:
     *
     * 1) switching on a structattr always switches on its parent struct
     * 2) switching off a structattr switches off its parent struct in case
     *    there are no more 'on' structattrs in the structure
     * 3) switching on a struct does not affect structattrs
     * 4) switching off a struct turns off all its child structattrs
     */
    private toggleStructure(structIdent:string, structAttrIdent:string):void {
        const struct = this.structList.find(item => item.n == structIdent);

        if (!struct) {
            throw new Error('structure not found: ' + structIdent);
        }
        const structIdx = this.structList.indexOf(struct);

        // first, test whether we operate with structattr
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
            // now we have to process its parent struct according
            // to the rules 1 & 2
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

        } else { // we are just changing a struct
            if (struct.selected) { // rule 4
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

        this.referenceList = Immutable.List<ViewOptions.RefsDesc>(data.AvailRefs.map(item => {
            return {
                n: item.n,
                label: item.label,
                selected: item.sel === 'selected' ? true : false
            };
        }));

        this.fixedAttr = data.FixedAttr;
        this.hasLoadedData = true;
    }

    loadData():RSVP.Promise<ViewOptions.PageData> {
        let args = this.layoutModel.getConcArgs();
        args.set('format', 'json');
        return this.layoutModel.ajax(
            'GET',
            this.layoutModel.createActionUrl('options/viewattrs'),
            args,
            {contentType : 'application/x-www-form-urlencoded'}

        ).then(
            (data:any) => {
                let imported:ViewOptions.PageData = {
                    AttrList: data['AttrList'],
                    FixedAttr: data['fixed_attr'],
                    CurrentAttrs: data['CurrentAttrs'],
                    AvailStructs: data['Availstructs'],
                    StructAttrs: data['structattrs'],
                    CurrStructAttrs: data['curr_structattrs'],
                    AvailRefs: data['Availrefs'],
                }
                this.initFromPageData(imported);
                return imported;
            }
        );
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

    getReferences():Immutable.List<ViewOptions.RefsDesc> {
        return this.referenceList;
    }

    getSelectAllAttributes():boolean {
        return this.selectAllAttrs;
    }

    getSelectAllReferences():boolean {
        return this.selectAllReferences;
    }

}