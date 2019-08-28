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

import {Kontext, ViewOptions} from '../../types/common';
import * as Immutable from 'immutable';
import {PageModel} from '../../app/main';
import { MultiDict } from '../../util';
import { Action, IFullActionControl, StatelessModel, SEDispatcher } from 'kombo';
import { tap } from 'rxjs/operators';


export const transformVmode = (vmode:string, attrAllPos:string):ViewOptions.AttrViewMode => {
    if (vmode === 'visible' && attrAllPos === 'all') {
        return ViewOptions.AttrViewMode.VISIBLE_ALL;

    } else if (vmode === 'mixed' && attrAllPos === 'all' ||
            vmode === 'visible' && attrAllPos === 'kw' /* legacy compatibility variant */) {
        return ViewOptions.AttrViewMode.VISIBLE_KWIC;

    } else if (vmode === 'mouseover' && attrAllPos === 'all') {
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
    fixedAttr:string|null;
    showConcToolbar:boolean;
    referenceList:Immutable.List<ViewOptions.RefsDesc>;
    selectAllReferences:boolean;
    hasLoadedData:boolean;
    attrVmode:string;
    extendedVmode:ViewOptions.AttrViewMode;
    attrAllpos:string; // kw/all
    isBusy:boolean;
    userIsAnonymous:boolean;
    corpusIdent:Kontext.FullCorpusIdent;
    corpusUsesRTLText:boolean;
}


export enum ActionName {
    LoadData = 'VIEW_OPTIONS_LOAD_DATA',
    LoadDataDone = 'VIEW_OPTIONS_LOAD_DATA_DONE',
    UpdateAttrVisibility = 'VIEW_OPTIONS_UPDATE_ATTR_VISIBILITY',
    ToggleAttribute = 'VIEW_OPTIONS_TOGGLE_ATTRIBUTE',
    ToggleAllAttributes = 'VIEW_OPTIONS_TOGGLE_ALL_ATTRIBUTES',
    ToggleStructure = 'VIEW_OPTIONS_TOGGLE_STRUCTURE',
    ToggleReference = 'VIEW_OPTIONS_TOGGLE_REFERENCE',
    ToggleAllReferences = 'VIEW_OPTIONS_TOGGLE_ALL_REFERENCES',
    SaveSettings = 'VIEW_OPTIONS_SAVE_SETTINGS',
    SaveSettingsDone = 'VIEW_OPTIONS_SAVE_SETTINGS_DONE'
}


export class CorpusViewOptionsModel extends StatelessModel<CorpusViewOptionsModelState> implements ViewOptions.ICorpViewOptionsModel {

    private readonly layoutModel:PageModel;

    private updateHandlers:Immutable.List<(data:ViewOptions.SaveViewAttrsOptionsResponse)=>void>;

    constructor(dispatcher:IFullActionControl, layoutModel:PageModel, corpusIdent:Kontext.FullCorpusIdent,
            userIsAnonymous:boolean) {
        super(
            dispatcher,
            {
                attrList: Immutable.List<ViewOptions.AttrDesc>(),
                selectAllAttrs: false,
                structList: Immutable.List<ViewOptions.StructDesc>(),
                structAttrs: Immutable.Map<string, Immutable.List<ViewOptions.StructAttrDesc>>(),
                fixedAttr: null,
                showConcToolbar: false,
                referenceList: Immutable.List<ViewOptions.RefsDesc>(),
                selectAllReferences: false,
                hasLoadedData: false,
                attrVmode: 'mixed',
                attrAllpos: 'all',
                extendedVmode: transformVmode('mixed', 'all'),
                isBusy: false,
                userIsAnonymous: userIsAnonymous,
                corpusIdent: corpusIdent,
                corpusUsesRTLText: layoutModel.getConf<boolean>('TextDirectionRTL')
            }
        );
        this.layoutModel = layoutModel;
        this.updateHandlers = Immutable.List<()=>void>();

        this.actionMatch = {
            [ActionName.LoadData]: (state, action) => {
                const newState = this.copyState(state);
                newState.isBusy = true;
                return newState;
            },
            [ActionName.LoadDataDone]: (state, action) => {
                const newState = this.copyState(state);
                this.initFromPageData(newState, action.payload['data']);
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
                this.toggleAttribute(newState, action.payload['idx']);
                return newState;
            },
            [ActionName.ToggleAllAttributes]: (state, action) => {
                const newState = this.copyState(state);
                this.toggleAllAttributes(newState);
                return newState;
            },
            [ActionName.ToggleStructure]: (state, action) => {
                const newState = this.copyState(state);
                this.toggleStructure(newState, action.payload['structIdent'],
                    action.payload['structAttrIdent']);
                return newState;
            },
            [ActionName.ToggleReference]: (state, action) => {
                const newState = this.copyState(state);
                this.toggleReference(newState, action.payload['idx']);
                return newState;
            },
            [ActionName.ToggleAllReferences]: (state, action) => {
                const newState = this.copyState(state);
                this.toggleAllReferences(newState);
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
            case ActionName.LoadData:
                this.loadData(dispatch);
            break;
            case ActionName.SaveSettings:
                this.saveSettings(state, dispatch);
            break;
        }
    }

    addOnSave(fn:(data:ViewOptions.SaveViewAttrsOptionsResponse)=>void):void {
        this.updateHandlers = this.updateHandlers.push(fn);
    }

    private setAttrVisibilityMode(state:CorpusViewOptionsModelState, value:ViewOptions.AttrViewMode):void {
        switch (value) {
            case ViewOptions.AttrViewMode.VISIBLE_ALL:
                state.attrVmode = 'visible';
                state.attrAllpos = 'all';
                state.extendedVmode = value;
            break;
            case ViewOptions.AttrViewMode.VISIBLE_KWIC:
                state.attrVmode = 'mixed';
                state.attrAllpos = 'all';
                state.extendedVmode = value;
            break;
            case ViewOptions.AttrViewMode.MOUSEOVER:
                state.attrVmode = 'mouseover';
                state.attrAllpos = 'all';
                state.extendedVmode = value;
            break;
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
            setrefs: state.referenceList.filter(item => item.selected).map(item => item.n).toArray(),
            setattr_allpos: state.attrAllpos,
            setattr_vmode: state.attrVmode
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
                (data) => {
                    if (state.attrAllpos === 'all') {
                        this.layoutModel.replaceConcArg('ctxattrs', [formArgs['setattrs'].join(',')]);

                    } else if (state.attrAllpos === 'kw') {
                        this.layoutModel.replaceConcArg('ctxattrs',
                                [this.layoutModel.getConf<string>('baseAttr')]);
                    }
                    this.layoutModel.replaceConcArg('attrs', [formArgs['setattrs'].join(',')]);
                    this.layoutModel.replaceConcArg('attr_allpos', [formArgs['setattr_allpos']])
                    this.layoutModel.replaceConcArg('attr_vmode', [formArgs['setattr_vmode']]);
                    this.layoutModel.replaceConcArg('structs', [formArgs['setstructs'].join(',')]);
                    this.layoutModel.replaceConcArg('refs', [formArgs['setrefs'].join(',')]);
                    this.updateHandlers.forEach(fn => fn(data));
                    this.layoutModel.resetMenuActiveItemAndNotify();
                }
            )
        ).subscribe(
            (_) => {
                dispatch({
                    name: ActionName.SaveSettingsDone,
                    payload: {}
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

    private toggleAllReferences(state:CorpusViewOptionsModelState):void {
        state.selectAllReferences = !state.selectAllReferences;
        state.referenceList = state.referenceList.map(item => {
            return {
                n: item.n,
                label: item.label,
                selected: state.selectAllReferences
            }
        }).toList();
    }

    private toggleReference(state:CorpusViewOptionsModelState, idx:number):void {
        const currItem = state.referenceList.get(idx);
        state.referenceList = state.referenceList.set(idx, {
            label: currItem.label,
            n: currItem.n,
            selected: !currItem.selected
        });
        state.selectAllReferences = false;
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
        state.selectAllAttrs = false;
    }

    private hasSelectedStructAttrs(state:CorpusViewOptionsModelState, structIdent:string):boolean {
        return state.structAttrs.get(structIdent).find(item => item.selected) !== undefined;
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
                    selected: sel
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
                selected: !struct.selected
            });
        }
    }


    initFromPageData(state:CorpusViewOptionsModelState, data:ViewOptions.PageData):void {
        state.attrList = Immutable.List(data.AttrList.map(item => {
            return {
                label: item.label,
                n: item.n,
                selected: data.CurrentAttrs.indexOf(item.n) > -1 ? true : false,
                locked: item.n === data.FixedAttr ? true : false
            };
        }));
        state.structList = Immutable.List(data.AvailStructs.map(item => {
            return {
                label: item.label,
                n: item.n,
                selected: item.sel === 'selected' ? true : false,
                locked: false
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

        state.referenceList = Immutable.List<ViewOptions.RefsDesc>(data.AvailRefs.map(item => {
            return {
                n: item.n,
                label: item.label,
                selected: item.sel === 'selected' ? true : false
            };
        }));
        state.fixedAttr = data.FixedAttr;
        state.attrVmode = data.AttrVmode;
        state.extendedVmode = transformVmode(state.attrVmode, state.attrAllpos);
        state.attrAllpos = state.attrVmode !== 'mouseover' ? data.AttrAllpos : 'all';
        state.hasLoadedData = true;
        state.showConcToolbar = data.ShowConcToolbar;
    }

    private loadData(dispatch:SEDispatcher):void {
        const args = this.layoutModel.getConcArgs();
        args.set('format', 'json');
        this.layoutModel.ajax$(
            'GET',
            this.layoutModel.createActionUrl('options/viewattrs', args),
            {}

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
                            ShowConcToolbar: data.use_conc_toolbar
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
    }

}