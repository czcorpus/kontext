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

import { Kontext, ViewOptions } from '../../types/common';
import * as Immutable from 'immutable';
import { PageModel } from '../../app/page';
import { MultiDict } from '../../util';
import { Action, IFullActionControl, StatelessModel, SEDispatcher } from 'kombo';
import { tap, concatMap } from 'rxjs/operators';
import { Observable } from 'rxjs';


export const transformVmode = (vmode:string, attrAllPos:ViewOptions.PosAttrViewScope):ViewOptions.AttrViewMode => {
    if (vmode === ViewOptions.PosAttrViewMode.MULTILINE && attrAllPos === ViewOptions.PosAttrViewScope.ALL) {
        return ViewOptions.AttrViewMode.VISIBLE_MULTILINE;

    } else if (vmode === ViewOptions.PosAttrViewMode.VISIBLE && attrAllPos === ViewOptions.PosAttrViewScope.ALL) {
        return ViewOptions.AttrViewMode.VISIBLE_ALL;

    } else if (vmode === ViewOptions.PosAttrViewMode.MIXED && attrAllPos === ViewOptions.PosAttrViewScope.ALL ||
            vmode === ViewOptions.PosAttrViewMode.VISIBLE && attrAllPos === ViewOptions.PosAttrViewScope.KWIC /* legacy compatibility variant */) {
        return ViewOptions.AttrViewMode.VISIBLE_KWIC;

    } else if (vmode === ViewOptions.PosAttrViewMode.MOUSEOVER && attrAllPos === ViewOptions.PosAttrViewScope.ALL) {
        return ViewOptions.AttrViewMode.MOUSEOVER;

    } else {
        console.warn(`Fixing incorrect internal attribute viewing mode configuration: [${vmode}, ${attrAllPos}].`);
        return ViewOptions.AttrViewMode.VISIBLE_KWIC;
    }
}


export interface CorpusViewOptionsModelState {

    attrList:Immutable.List<ViewOptions.AttrDesc>;
    selectAllAttrs:boolean;
    structList:Immutable.List<ViewOptions.StructDesc>;
    structAttrs:ViewOptions.AvailStructAttrs;
    selectAllStruct:boolean,
    fixedAttr:string|null;
    showConcToolbar:boolean;
    refList:Immutable.List<ViewOptions.RefDesc>;
    refAttrs:Immutable.Map<string, Immutable.List<ViewOptions.RefAttrDesc>>;
    selectAllRef:boolean;
    hasLoadedData:boolean;
    attrVmode:ViewOptions.PosAttrViewMode;
    extendedVmode:ViewOptions.AttrViewMode;
    attrAllpos:ViewOptions.PosAttrViewScope;
    isBusy:boolean;
    userIsAnonymous:boolean;
    corpusIdent:Kontext.FullCorpusIdent;
    corpusUsesRTLText:boolean;
    baseViewAttr:string;
    basePosAttr:string;
}


export enum ActionName {
    LoadDataDone = 'VIEW_OPTIONS_LOAD_DATA_DONE',
    DataReady = 'VIEW_OPTIONS_DATA_READY',
    UpdateAttrVisibility = 'VIEW_OPTIONS_UPDATE_ATTR_VISIBILITY',
    ToggleAttribute = 'VIEW_OPTIONS_TOGGLE_ATTRIBUTE',
    ToggleAllAttributes = 'VIEW_OPTIONS_TOGGLE_ALL_ATTRIBUTES',
    ToggleStructure = 'VIEW_OPTIONS_TOGGLE_STRUCTURE',
    ToggleAllStructures = 'VIEW_OPTIONS_TOGGLE_ALL_STRUCTURES',
    ToggleAllStructureAttrs = 'VIEW_OPTIONS_TOGGLE_ALL_STRUCTURE_ATTRS',
    ToggleReference = 'VIEW_OPTIONS_TOGGLE_REFERENCE',
    ToogleAllReferenceAttrs = 'VIEW_OPTIONS_TOGGLE_ALL_REF_ATTRS',
    ToggleAllReferences = 'VIEW_OPTIONS_TOGGLE_ALL_REFERENCES',
    SetBaseViewAttr = 'VIEW_OPTIONS_SET_BASE_VIEW_ATTR',
    SaveSettings = 'VIEW_OPTIONS_SAVE_SETTINGS',
    SaveSettingsDone = 'VIEW_OPTIONS_SAVE_SETTINGS_DONE'
}


export class CorpusViewOptionsModel extends StatelessModel<CorpusViewOptionsModelState> {

    private readonly layoutModel:PageModel;

    constructor(dispatcher:IFullActionControl, layoutModel:PageModel, corpusIdent:Kontext.FullCorpusIdent,
            userIsAnonymous:boolean) {
        super(
            dispatcher,
            {
                attrList: Immutable.List<ViewOptions.AttrDesc>(),
                selectAllAttrs: false,
                structList: Immutable.List<ViewOptions.StructDesc>(),
                structAttrs: Immutable.Map<string, Immutable.List<ViewOptions.StructAttrDesc>>(),
                selectAllStruct: false,
                fixedAttr: null,
                showConcToolbar: false,
                refList: Immutable.List<ViewOptions.StructDesc>(),
                refAttrs: Immutable.Map<string, Immutable.List<ViewOptions.RefAttrDesc>>(),
                selectAllRef: false,
                hasLoadedData: false,
                attrVmode: ViewOptions.PosAttrViewMode.MIXED,
                attrAllpos: ViewOptions.PosAttrViewScope.ALL,
                extendedVmode: transformVmode(ViewOptions.PosAttrViewMode.MIXED, ViewOptions.PosAttrViewScope.ALL),
                isBusy: false,
                userIsAnonymous: userIsAnonymous,
                corpusIdent: corpusIdent,
                corpusUsesRTLText: layoutModel.getConf<boolean>('TextDirectionRTL'),
                basePosAttr: layoutModel.getConf<string>('baseAttr'),
                baseViewAttr: layoutModel.getConf<string>('baseViewAttr') || layoutModel.getConf<string>('baseAttr')
            }
        );
        this.layoutModel = layoutModel;
        this.actionMatch = {
            'MAIN_MENU_SHOW_ATTRS_VIEW_OPTIONS': (state, action) => {
                const newState = this.copyState(state);
                newState.isBusy = true;
                return newState;
            },
            [ActionName.LoadDataDone]: (state, action) => {
                const newState = this.copyState(state);
                this.importData(newState, action.payload['data']);
                newState.isBusy = false;
                return newState;
            },
            [ActionName.DataReady]: (state, action) => {
                const newState = this.copyState(state);
                newState.isBusy = false;
                return newState;
            },
            [ActionName.UpdateAttrVisibility]: (state, action) => {
                const newState = this.copyState(state);
                this.setAttrVisibilityMode(newState, action.payload['value']);
                return newState;
            },
            [ActionName.ToggleAttribute]: (state, action) => {
                const newState = this.copyState(state);
                const attr = newState.attrList.get(action.payload['idx']);
                if (!attr.selected || attr.n !== state.baseViewAttr) {
                    this.toggleAttribute(newState, action.payload['idx']);
                }
                return newState;
            },
            [ActionName.ToggleAllAttributes]: (state, action) => {
                const newState = this.copyState(state);
                this.toggleAllAttributes(newState);
                if (!newState.attrList.slice(1).find(v => v.selected)) {
                    newState.baseViewAttr = newState.attrList.get(0).n;
                }
                return newState;
            },
            [ActionName.ToggleStructure]: (state, action) => {
                const newState = this.copyState(state);
                this.toggleStructure(newState, action.payload['structIdent'], action.payload['structAttrIdent']);
                return newState;
            },
            [ActionName.ToggleAllStructures]: (state, action) => {
                const newState = this.copyState(state);
                this.toggleAllStructures(newState);
                return newState;
            },
            [ActionName.ToggleAllStructureAttrs]: (state, action) => {
                const newState = this.copyState(state);
                this.toggleAllStructureAttrs(newState, action.payload['structIdent']);
                return newState;
            },
            [ActionName.ToggleReference]: (state, action) => {
                const newState = this.copyState(state);
                this.toggleReference(newState, action.payload['refIdent'], action.payload['refAttrIdent']);
                return newState;
            },
            [ActionName.ToogleAllReferenceAttrs]: (state, action) => {
                const newState = this.copyState(state);
                this.toggleAllReferenceAttrs(newState, action.payload['refIdent']);
                return newState;
            },
            [ActionName.ToggleAllReferences]: (state, action) => {
                const newState = this.copyState(state);
                this.toggleAllReferences(newState);
                return newState;
            },
            [ActionName.SetBaseViewAttr]: (state, action) => {
                const newState = this.copyState(state);
                newState.baseViewAttr = action.payload['value'];
                const idx = newState.attrList.findIndex(v => v.n === newState.baseViewAttr);
                if (idx > -1 && !newState.attrList.get(idx).selected) {
                    newState.attrList = newState.attrList.set(
                        idx,
                        {...newState.attrList.get(idx), selected: true}
                    );
                }
                return newState;
            },
            [ActionName.SaveSettings]: (state, action) => {
                const newState = this.copyState(state);
                newState.isBusy = true;
                return newState;
            },
            [ActionName.SaveSettings]: (state, action) => {
                const newState = this.copyState(state);
                newState.isBusy = false;
                return newState;
            }
        };
    }

    sideEffects(state:CorpusViewOptionsModelState, action:Action, dispatch:SEDispatcher):void {
        switch (action.name) {
            case ActionName.SaveSettings:
                this.saveSettings(state, dispatch);
            break;
            case 'MAIN_MENU_SHOW_ATTRS_VIEW_OPTIONS':
                if (!state.hasLoadedData) {
                    this.suspendWithTimeout(20000, {}, (action , syncData) => {
                        return null;

                    }).pipe(
                        concatMap(
                            (v) => this.loadData()
                        )
                    ).subscribe(
                        (data:ViewOptions.LoadOptionsResponse) => {
                            dispatch({
                                name: ActionName.LoadDataDone,
                                payload: {
                                    data: {
                                        AttrList: data.AttrList,
                                        FixedAttr: data.fixed_attr,
                                        CurrentAttrs: data.CurrentAttrs,
                                        AvailStructs: data.Availstructs,
                                        StructAttrs: data.structattrs,
                                        CurrStructAttrs: data.curr_structattrs,
                                        AvailRefs: data.Availrefs,
                                        AttrAllpos: data.attr_allpos,
                                        AttrVmode: data.attr_vmode,
                                        ShowConcToolbar: data.use_conc_toolbar,
                                        BaseViewAttr: data.base_viewattr
                                    }
                                }
                            });
                        },
                        (err:Error) => {
                            this.layoutModel.showMessage('error', err);
                            dispatch({
                                name: ActionName.LoadDataDone,
                                error: err
                            });
                        }
                    );

                } else {
                    dispatch({
                        name: ActionName.DataReady
                    });
                }
            break;
            case ActionName.ToggleAttribute:
                const attr = state.attrList.get(action.payload['idx']);
                if (attr.selected && attr.n === state.baseViewAttr) {
                    this.layoutModel.showMessage('error', this.layoutModel.translate('options__cannot_remove_attribute_set_as_main'));
                }
            break;
        }
    }

    private setAttrVisibilityMode(state:CorpusViewOptionsModelState, value:ViewOptions.AttrViewMode):void {
        switch (value) {
            case ViewOptions.AttrViewMode.VISIBLE_MULTILINE:
                state.attrVmode = ViewOptions.PosAttrViewMode.MULTILINE;
                state.attrAllpos = ViewOptions.PosAttrViewScope.ALL;
                state.extendedVmode = value;
            break;
            case ViewOptions.AttrViewMode.VISIBLE_ALL:
                state.attrVmode = ViewOptions.PosAttrViewMode.VISIBLE;
                state.attrAllpos = ViewOptions.PosAttrViewScope.ALL;
                state.extendedVmode = value;
            break;
            case ViewOptions.AttrViewMode.VISIBLE_KWIC:
                state.attrVmode = ViewOptions.PosAttrViewMode.MIXED;
                state.attrAllpos = ViewOptions.PosAttrViewScope.KWIC;
                state.extendedVmode = value;
            break;
            case ViewOptions.AttrViewMode.MOUSEOVER:
                state.attrVmode = ViewOptions.PosAttrViewMode.MOUSEOVER;
                state.attrAllpos = ViewOptions.PosAttrViewScope.ALL;
                state.extendedVmode = value;
            break;
            default:
                throw new Error('Unknown view mode');
        }
    }

    private serialize(state:CorpusViewOptionsModelState):any {

        // we have to make sure 'word' is always the first - otherwise
        // we may produce incorrect visible/mouseover attribute configuration.
        const attrCmp = (a1:ViewOptions.StructAttrDesc, a2:ViewOptions.StructAttrDesc) => {
            if (a1.n === 'word') {
                return -1;

            } else if (a2.n === 'word') {
                return 1;

            } else {
                return a1.n.localeCompare(a2.n);
            }
        };

        const ans = {
            setattrs: state.attrList
                .sort(attrCmp)
                .filter(item => item.selected)
                .map(item => item.n)
                .toArray(),
            setstructs: state.structList.filter(item => item.selected).map(item => item.n).toArray(),
            setstructattrs: state.structAttrs
                            .map((v, k) => v.filter(x => x.selected))
                            .map((v, k) => v.map(x => `${k}.${x.n}`))
                            .valueSeq()
                            .flatMap(x => x)
                            .toArray(),
                            setrefs: state.refAttrs.valueSeq().reduce((acc, val) => acc = [...acc, ...val.filter(item => item.selected).toArray()], []).map(item => item.n),
            setattr_allpos: state.attrAllpos,
            setattr_vmode: state.attrVmode,
            base_viewattr: state.baseViewAttr
        };

        return ans;
    }

    private saveSettings(state:CorpusViewOptionsModelState, dispatch:SEDispatcher):void {
        const corpname = this.layoutModel.getCorpusIdent().id;
        const urlArgs = new MultiDict([['corpname', corpname], ['format', 'json']]);
        const formArgs = this.serialize(state);

        this.layoutModel.ajax$<ViewOptions.SaveViewAttrsOptionsResponse>(
            'POST',
            this.layoutModel.createActionUrl('options/viewattrsx', urlArgs),
            formArgs

        ).pipe(
            tap(
                () => {
                    if (state.attrAllpos === 'all') {
                        this.layoutModel.replaceConcArg('ctxattrs', [formArgs['setattrs'].join(',')]);

                    } else if (state.attrAllpos === 'kw') {
                        this.layoutModel.replaceConcArg('ctxattrs',
                                [this.layoutModel.getConf<string>('baseAttr')]);
                    }
                    this.layoutModel.replaceConcArg('attrs', [formArgs['setattrs'].join(',')]);
                    this.layoutModel.replaceConcArg('attr_allpos', [formArgs['setattr_allpos']])
                    this.layoutModel.replaceConcArg('attr_vmode', [formArgs['setattr_vmode']]);
                    this.layoutModel.replaceConcArg('base_viewattr', [formArgs['base_viewattr']]);
                    this.layoutModel.replaceConcArg('structs', [formArgs['setstructs'].join(',')]);
                    this.layoutModel.replaceConcArg('refs', [formArgs['setrefs'].join(',')]);
                    this.layoutModel.resetMenuActiveItemAndNotify();
                }
            )
        ).subscribe(
            (data) => {
                dispatch({
                    name: ActionName.SaveSettingsDone,
                    payload: {
                        widectxGlobals: data.widectx_globals,
                        baseViewAttr: state.baseViewAttr
                    }
                });
                this.layoutModel.showMessage('info', this.layoutModel.translate('options__options_saved'));
            },
            (err) => {
                dispatch({
                    name: ActionName.SaveSettingsDone,
                    error: err
                });
                this.layoutModel.showMessage('error', err);
            }
        );
    }

    private toggleAllAttributes(state:CorpusViewOptionsModelState):void {
        state.selectAllAttrs = !state.selectAllAttrs;
        state.attrList = state.attrList
            .map(item => {
                return {
                    n: item.n,
                    label: item.label,
                    locked: item.locked,
                    selected: item.locked ? true : state.selectAllAttrs
                }
            })
            .toList();
    }

    private toggleAllStructures(state:CorpusViewOptionsModelState):void {
        state.selectAllStruct = !state.selectAllStruct;
        state.structList = state.structList.map(item => {
            return {
                n: item.n,
                label: item.label,
                locked: item.locked,
                selected: item.locked ? true : state.selectAllStruct,
                selectAllAttrs: state.selectAllStruct,
            }
        }).toList();
        state.structAttrs = state.structAttrs.map(structAttrs => structAttrs.map(attr => {
            return {
                n: attr.n,
                selected: state.selectAllStruct,
            }
        }).toList()).toMap();
    }

    private toggleAllStructureAttrs(state:CorpusViewOptionsModelState, structIdent:string):void {
        const struct = state.structList.find(item => item.n == structIdent);
        const structIdx = state.structList.indexOf(struct);

        struct.selectAllAttrs = !struct.selectAllAttrs;
        struct.selected = struct.selectAllAttrs;
        state.structList = state.structList.set(structIdx, struct);

        const structAttrs = state.structAttrs.get(structIdent);
        state.structAttrs = state.structAttrs.set(structIdent, structAttrs.map(attr => {
            return {
                n: attr.n,
                selected: struct.selectAllAttrs,
            }
        }).toList());

        state.selectAllStruct = this.hasSelectedAllStructs(state);
    }

    private toggleAllReferenceAttrs(state:CorpusViewOptionsModelState, categoryIdent:string):void {
        let reference = state.refList.find(item => item.n===categoryIdent);
        const index = state.refList.indexOf(reference);
        reference.selectAllAttrs = !reference.selectAllAttrs;
        reference.selected = reference.selectAllAttrs;
        state.refList = state.refList.set(index, reference);

        state.refAttrs = state.refAttrs.set(categoryIdent, state.refAttrs.get(categoryIdent).map(value => {
            return {
                n: value.n,
                label: value.label,
                selected: reference.selectAllAttrs,
            }
        }).toList());
        state.selectAllRef = state.refList.every(item => item.selectAllAttrs);
    }

    private toggleAllReferences(state:CorpusViewOptionsModelState):void {
        state.selectAllRef = !state.selectAllRef;
        state.refList = state.refList.map(item => {
            return {
                label: item.label,
                n: item.n,
                selectAllAttrs: state.selectAllRef,
                selected: state.selectAllRef,
                locked: false,
            }
        }).toList();
        state.refAttrs = state.refAttrs.map(item => item.map(value => {
            return {
                n: value.n,
                label: value.label,
                selected: state.selectAllRef
            }
        }).toList()).toMap();
    }

    private toggleReference(state:CorpusViewOptionsModelState, refIdent:string, refAttrIdent:string):void {
        const refAttrs = state.refAttrs.get(refIdent);
        const reference = state.refList.find(value => value.n===refIdent);
        const index = state.refList.indexOf(reference);
        if (refAttrIdent===null) {
            reference.selected = !reference.selected;
            if (!reference.selected) {
                reference.selectAllAttrs = false;
                state.refAttrs = state.refAttrs.set(refIdent, refAttrs.map(item => {
                    return {
                        n: item.n,
                        selected: false,
                        label: item.label,
                    }
                }).toList());
            }
        } else {
            state.refAttrs = state.refAttrs.set(refIdent, refAttrs.map(item =>
                item.n === refAttrIdent ?
                    {
                        label: item.label,
                        n: item.n,
                        selected: !item.selected
                    } :
                    item
            ).toList());
            reference.selected = state.refAttrs.get(refIdent).some(value => value.selected);
            reference.selectAllAttrs = state.refAttrs.get(refIdent).every(value => value.selected);
        }
        state.refList.set(index, reference);
        state.selectAllRef = state.refList.every(item => item.selectAllAttrs);
    }

    private toggleAttribute(state:CorpusViewOptionsModelState, idx:number):void {
        const currItem = state.attrList.get(idx);
        state.attrList = state.attrList.set(idx, {
            n: currItem.n,
            label: currItem.label,
            locked: currItem.locked,
            selected: !currItem.selected
        });
        if (state.attrList.filter(v => v.selected).size === 0) {
            const srchIdx = state.attrList.findIndex(v => v.locked);
            if (srchIdx > -1) {
                const tmp = state.attrList.get(srchIdx);
                state.attrList = state.attrList.set(srchIdx, {
                    n: tmp.n,
                    label: tmp.label,
                    locked: tmp.locked,
                    selected: true
                });
            }
        }
        state.selectAllAttrs = state.attrList.every(attr => attr.selected);
    }

    private hasSelectedStructAttrs(state:CorpusViewOptionsModelState, structIdent:string):boolean {
        return state.structAttrs.get(structIdent).find(item => item.selected) !== undefined;
    }

    private hasSelectedAllStructAttrs(state:CorpusViewOptionsModelState, structIdent:string):boolean {
        return state.structAttrs.has(structIdent) && state.structAttrs.get(structIdent).every(item => item.selected);
    }

    private hasSelectedAllStructs(state:CorpusViewOptionsModelState):boolean {
        return state.structAttrs.map(value => value.every(attr => attr.selected)).every(value => value);
    }

    private clearStructAttrSelection(state:CorpusViewOptionsModelState, structIdent:string):void {
        if (state.structAttrs.has(structIdent)) {
            state.structAttrs = state.structAttrs.set(
                structIdent,
                state.structAttrs.get(structIdent).map(item => {
                    return {
                        n: item.n,
                        selected: false
                    };
                }).toList()
            );
        }
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
    private toggleStructure(state:CorpusViewOptionsModelState, structIdent:string, structAttrIdent:string):void {
        const struct = state.structList.find(item => item.n == structIdent);

        if (!struct) {
            throw new Error('structure not found: ' + structIdent);
        }
        const structIdx = state.structList.indexOf(struct);

        // first, test whether we operate with structattr
        if (structAttrIdent !== null) {
            const currStructAttrs = state.structAttrs.get(structIdent);
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
                state.structAttrs = state.structAttrs.set(structIdent, newStructAttrs);
            }
            // now we have to process its parent struct according
            // to the rules 1 & 2
            if (structAttrIdx !== undefined) {
                let tmp = state.structAttrs.get(structIdent).get(structAttrIdx).selected;
                let sel;

                if (tmp) {
                    sel = true;

                } else {
                    sel = this.hasSelectedStructAttrs(state, structIdent);
                }

                state.structList = state.structList.set(structIdx, {
                    label: struct.label,
                    n: struct.n,
                    locked: struct.locked,
                    selected: sel,
                    selectAllAttrs: this.hasSelectedAllStructAttrs(state, structIdent),
                });
            }

        } else { // we are just changing a struct
            if (struct.selected) { // rule 4
                this.clearStructAttrSelection(state, structIdent);
            }
            state.structList = state.structList.set(structIdx, {
                label: struct.label,
                n: struct.n,
                locked: struct.locked,
                selected: !struct.selected,
                selectAllAttrs: false,
            });
        }
        state.selectAllStruct = this.hasSelectedAllStructs(state);
    }


    importData(state:CorpusViewOptionsModelState, data:ViewOptions.PageData):void {
        state.attrList = Immutable.List(data.AttrList.map(item => {
            return {
                label: item.label,
                n: item.n,
                selected: data.CurrentAttrs.indexOf(item.n) > -1 ? true : false,
                locked: item.n === data.FixedAttr ? true : false,
            };
        }));
        state.structAttrs = Immutable.Map<string, Immutable.List<ViewOptions.StructAttrDesc>>(
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
        state.structList = Immutable.List(
            data.AvailStructs
                .map(item => ({
                    label: item.label,
                    n: item.n,
                    selected: item.sel === 'selected' ? true : false,
                    locked: false,
                    selectAllAttrs: this.hasSelectedAllStructAttrs(state, item.n),
                }))
        );
        data.AvailStructs.forEach(struct => {
            if (!state.structAttrs.has(struct.n)) {
                state.structAttrs = state.structAttrs.set(struct.n, Immutable.List());
            }
        });

        state.refAttrs = Immutable.List(data.AvailRefs).groupBy(value => value.n.split('.')[0].replace('=', '')).map(item => item.map(value => {
            return {
                n: value.n,
                label: value.label,
                selected: value.sel === 'selected' ? true : false
            };
        }).toList()).toMap();

        state.refList = state.refAttrs.keySeq().map(value => {
            return {
                label: value,
                n: value,
                selectAllAttrs: state.refAttrs.get(value).every(value => value.selected),
                selected: state.refAttrs.get(value).some(value => value.selected),
                locked: false,
            }
        }).toList();

        state.selectAllRef = state.refList.every(item => item.selectAllAttrs);
        state.fixedAttr = data.FixedAttr;
        state.attrVmode = data.AttrVmode;
        state.extendedVmode = transformVmode(state.attrVmode, state.attrAllpos);
        state.attrAllpos = state.attrVmode !== 'mouseover' ? data.AttrAllpos : ViewOptions.PosAttrViewScope.ALL;
        state.hasLoadedData = true;
        state.showConcToolbar = data.ShowConcToolbar;
        state.baseViewAttr = data.BaseViewAttr;
    }

    private loadData():Observable<ViewOptions.LoadOptionsResponse> {
        const args = this.layoutModel.getConcArgs();
        args.set('format', 'json');
        return this.layoutModel.ajax$<ViewOptions.LoadOptionsResponse>(
            'GET',
            this.layoutModel.createActionUrl('options/viewattrs', args),
            {}
        );
    }

}