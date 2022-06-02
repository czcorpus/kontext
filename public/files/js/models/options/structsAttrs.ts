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

import { IFullActionControl, StatelessModel, SEDispatcher } from 'kombo';
import { tap, concatMap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { pipe, List, Dict, HTTP, tuple } from 'cnc-tskit';

import * as Kontext from '../../types/kontext';
import * as ViewOptions from '../../types/viewOptions';
import { PageModel } from '../../app/page';
import { Actions } from './actions';
import { Actions as MainMenuActions } from '../mainMenu/actions';
import { PluginName } from '../../app/plugin';
import { ConcServerArgs } from '../concordance/common';


interface StructAttrsSubmit {
    corpname:string;
    attrs:Array<string>;
    structs:Array<string>;
    structattrs:Array<string>;
    refs:Array<string>;
    attr_vmode:ViewOptions.AttrViewMode;
    base_viewattr:string;
    qs_enabled:boolean;
}


export interface CorpusViewOptionsModelState {

    attrList:Array<ViewOptions.AttrDesc>;
    alignCommonPosAttrs:Array<string>;
    selectAllAttrs:boolean;
    structList:Array<ViewOptions.StructDesc>;
    structAttrs:ViewOptions.AvailStructAttrs;
    selectAllStruct:boolean,
    fixedAttr:string|null;
    showConcToolbar:boolean;
    refList:Array<ViewOptions.RefDesc>;
    refAttrs:{[key:string]:Array<ViewOptions.RefAttrDesc>};
    selectAllRef:boolean;
    hasLoadedData:boolean;
    attrVmode:ViewOptions.AttrViewMode;
    isBusy:boolean;
    userIsAnonymous:boolean;
    corpusIdent:Kontext.FullCorpusIdent;
    corpusUsesRTLText:boolean;
    baseViewAttr:string;
    basePosAttr:string;
    qsEnabled:boolean;
    qsPluginAvaiable:boolean;
    qsProviders:Array<string>;
}

/**
 * CorpusViewOptionsModel model handles corpus-related options
 * (e.g. which attributes to display in concordances).
 */
export class CorpusViewOptionsModel extends StatelessModel<CorpusViewOptionsModelState> {

    private readonly layoutModel:PageModel;

    constructor(
        dispatcher:IFullActionControl,
        layoutModel:PageModel,
        corpusIdent:Kontext.FullCorpusIdent,
        userIsAnonymous:boolean,
        qsProviders:Array<string>
    ) {
        super(
            dispatcher,
            {
                attrList: [],
                selectAllAttrs: false,
                structList: [],
                structAttrs: {},
                selectAllStruct: false,
                fixedAttr: null,
                showConcToolbar: false,
                refList: [],
                refAttrs: {},
                selectAllRef: false,
                hasLoadedData: false,
                attrVmode: ViewOptions.AttrViewMode.VISIBLE_ALL,
                isBusy: false,
                userIsAnonymous,
                corpusIdent,
                corpusUsesRTLText: layoutModel.getConf<boolean>('TextDirectionRTL'),
                basePosAttr: layoutModel.getConf<string>('baseAttr'),
                baseViewAttr: layoutModel.getConf<string>('baseViewAttr') ||
                    layoutModel.getConf<string>('baseAttr'),
                alignCommonPosAttrs: layoutModel.getConf<Array<string>>('AlignCommonPosAttrs'),
                qsEnabled: true,
                qsPluginAvaiable: layoutModel.pluginTypeIsActive(PluginName.QUERY_SUGGEST),
                qsProviders
            }
        );
        this.layoutModel = layoutModel;

        this.addActionHandler<typeof MainMenuActions.ShowAttrsViewOptions>(
            MainMenuActions.ShowAttrsViewOptions.name,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                if (!state.hasLoadedData) {
                    this.suspendWithTimeout(20000, {}, (action , syncData) => {
                        return null;

                    }).pipe(
                        concatMap(
                            (v) => this.loadData(state)
                        )
                    ).subscribe(
                        (data:ViewOptions.LoadOptionsResponse) => {
                            dispatch<typeof Actions.LoadDataDone>({
                                name: Actions.LoadDataDone.name,
                                payload: {
                                    data: {
                                        AttrList: data.AttrList,
                                        FixedAttr: data.fixed_attr,
                                        CurrentAttrs: data.CurrentAttrs,
                                        AvailStructs: data.Availstructs,
                                        StructAttrs: data.structattrs,
                                        CurrStructAttrs: data.curr_structattrs,
                                        AvailRefs: data.Availrefs,
                                        AttrVmode: data.attr_vmode,
                                        ShowConcToolbar: data.use_conc_toolbar,
                                        BaseViewAttr: data.base_viewattr,
                                        QueryHintEnabled: data.qs_enabled
                                    }
                                }
                            });
                        },
                        (err:Error) => {
                            this.layoutModel.showMessage('error', err);
                            dispatch<typeof Actions.LoadDataDone>({
                                name: Actions.LoadDataDone.name,
                                error: err
                            });
                        }
                    );

                } else {
                    dispatch<typeof Actions.DataReady>({
                        name: Actions.DataReady.name
                    });
                }
            }
        );

        this.addActionHandler<typeof Actions.LoadDataDone>(
            Actions.LoadDataDone.name,
            (state, action) => {
                this.importData(state, action.payload.data);
                state.isBusy = false;
            }
        );

        this.addActionHandler<typeof Actions.DataReady>(
            Actions.DataReady.name,
             (state, action) => {
                state.isBusy = false;
            }
        );

        this.addActionHandler<typeof Actions.UpdateAttrVisibility>(
            Actions.UpdateAttrVisibility.name,
            (state, action) => {
                state.attrVmode = action.payload.value;
            }
        );

        this.addActionHandler<typeof Actions.ChangeQuerySuggestionMode>(
            Actions.ChangeQuerySuggestionMode.name,
            (state, action) => {
                state.qsEnabled = action.payload.value;
            }
        );

        this.addActionHandler<typeof Actions.ToggleAttribute>(
            Actions.ToggleAttribute.name,
            (state, action) => {
                const attr = state.attrList[action.payload.idx];
                if (!attr.selected || attr.n !== state.baseViewAttr) {
                    this.toggleAttribute(state, action.payload.idx);
                }
            },
            (state, action, dispatch) => {
                const attr = state.attrList[action.payload.idx];
                if (attr.selected && attr.n === state.baseViewAttr) {
                    this.layoutModel.showMessage(
                        'error',
                        this.layoutModel.translate('options__cannot_remove_attribute_set_as_main')
                    );
                }
            }
        );

        this.addActionHandler<typeof Actions.ToggleAllAttributes>(
            Actions.ToggleAllAttributes.name,
            (state, action) => {
                this.toggleAllAttributes(state);
                if (!pipe(
                    state.attrList,
                    List.slice(1, state.attrList.length),
                    List.find(v => v.selected))
                ) {
                    state.baseViewAttr = state.attrList[0].n;
                }
            }
        );

        this.addActionHandler<typeof Actions.ToggleStructure>(
            Actions.ToggleStructure.name,
            (state, action) => {
                this.toggleStructure(
                    state, action.payload.structIdent, action.payload.structAttrIdent);
            }
        );

        this.addActionHandler<typeof Actions.ToggleAllStructures>(
            Actions.ToggleAllStructures.name,
            (state, action) => {
                this.toggleAllStructures(state);
            }
        );

        this.addActionHandler<typeof Actions.ToggleAllStructureAttrs>(
            Actions.ToggleAllStructureAttrs.name,
            (state, action) => {
                this.toggleAllStructureAttrs(state, action.payload.structIdent);
            }
        );

        this.addActionHandler<typeof Actions.ToggleReference>(
            Actions.ToggleReference.name,
            (state, action) => {
                this.toggleReference(state, action.payload.refIdent, action.payload.refAttrIdent);
            }
        );

        this.addActionHandler<typeof Actions.ToogleAllReferenceAttrs>(
            Actions.ToogleAllReferenceAttrs.name,
            (state, action) => {
                this.toggleAllReferenceAttrs(state, action.payload.refIdent);
            }
        );

        this.addActionHandler<typeof Actions.ToggleAllReferences>(
            Actions.ToggleAllReferences.name,
            (state, action) => {
                this.toggleAllReferences(state);
            }
        );

        this.addActionHandler<typeof Actions.SetBaseViewAttr>(
            Actions.SetBaseViewAttr.name,
            (state, action) => {
                state.baseViewAttr = action.payload.value;
                const idx = List.findIndex(v => v.n === state.baseViewAttr, state.attrList);
                if (idx > -1 && !state.attrList[idx].selected) {
                    state.attrList[idx] = {...state.attrList[idx], selected: true};
                }
            }
        );

        this.addActionHandler<typeof Actions.SaveSettings>(
            Actions.SaveSettings.name,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.saveSettings(state, dispatch);
            }
        );

        this.addActionHandler<typeof Actions.SaveSettingsDone>(
            Actions.SaveSettingsDone.name,
            (state, action) => {
                state.isBusy = false;
            }
        );
    }

    private serialize(state:CorpusViewOptionsModelState, corpname:string):StructAttrsSubmit {

        // we have to make sure 'word' is always the first - otherwise
        // we may produce incorrect visible/mouseover attribute configuration.
        const attrCmp = (a1:ViewOptions.StructAttrDesc, a2:ViewOptions.StructAttrDesc) => {
            if (a1.n === 'word') {
                return -1;

            } else if (a2.n === 'word') {
                return 1;

            } else {
                return 0;
            }
        };

        return {
            corpname,
            attrs: pipe(
                state.attrList,
                List.sorted(attrCmp),
                List.filter(item => item.selected),
                List.map(item => item.n)
            ),
            structs: pipe(
                state.structList,
                List.filter(item => item.selected),
                List.map(item => item.n)
            ),
            structattrs: pipe(
                state.structAttrs,
                Dict.map((v, k) => List.filter(x => x.selected, v)),
                Dict.map((v, k) => List.map(x => `${k}.${x.n}`, v)),
                Dict.values(),
                List.flatMap(x => x),
            ),
            refs: pipe(
                state.refAttrs,
                Dict.values(),
                List.reduce((acc, val) => [...acc, ...val.filter(item => item.selected)], []),
                List.map(item => item.n)
            ),
            attr_vmode: state.attrVmode,
            base_viewattr: state.baseViewAttr,
            qs_enabled: state.qsEnabled
        };
    }

    private saveSettings(state:CorpusViewOptionsModelState, dispatch:SEDispatcher):void {
        const formArgs = this.serialize(state, this.layoutModel.getCorpusIdent().id);

        this.layoutModel.ajax$<ViewOptions.SaveViewAttrsOptionsResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('options/viewattrsx'),
            formArgs,
            {contentType: 'application/json'}

        ).pipe(
            tap(
                () => {
                    if (state.attrVmode === ViewOptions.AttrViewMode.VISIBLE_KWIC) {
                        this.layoutModel.updateConcArgs({
                            ctxattrs: [this.layoutModel.getConf<string>('baseAttr')]
                        });

                    } else {
                        this.layoutModel.updateConcArgs({
                            ctxattrs: [...formArgs.attrs]
                        });
                    }
                    this.layoutModel.updateConcArgs<ConcServerArgs & {QSEnabled: boolean}>({
                        attrs: formArgs.attrs,
                        attr_vmode: formArgs.attr_vmode,
                        base_viewattr: formArgs.base_viewattr,
                        structs: formArgs.structs,
                        refs: formArgs.refs,
                        QSEnabled: formArgs.qs_enabled
                    });
                    this.layoutModel.resetMenuActiveItemAndNotify();
                }
            )
        ).subscribe({
            next: data => {
                dispatch<typeof Actions.SaveSettingsDone>({
                    name: Actions.SaveSettingsDone.name,
                    payload: {
                        widectxGlobals: data.widectx_globals,
                        baseViewAttr: state.baseViewAttr,
                        posAttrs: pipe(
                            state.attrList,
                            List.filter(a => a.selected),
                            List.map(a => a.n)
                        ),
                        attrVmode: state.attrVmode,
                        qsEnabled: state.qsEnabled
                    }
                });
                this.layoutModel.showMessage(
                    'info',
                    this.layoutModel.translate('options__options_saved')
                );
            },
            error: error => {
                dispatch<typeof Actions.SaveSettingsDone>({
                    name: Actions.SaveSettingsDone.name,
                    error
                });
                this.layoutModel.showMessage('error', error);
            }
        });
    }

    private toggleAllAttributes(state:CorpusViewOptionsModelState):void {
        state.selectAllAttrs = !state.selectAllAttrs;
        state.attrList = List.map(
            item => ({
                n: item.n,
                label: item.label,
                locked: item.locked,
                selected: item.locked ? true : state.selectAllAttrs
            }),
            state.attrList
        );
    }

    private toggleAllStructures(state:CorpusViewOptionsModelState):void {
        state.selectAllStruct = !state.selectAllStruct;
        state.structList = List.map(
            item => ({
                n: item.n,
                label: item.label,
                locked: item.locked,
                selected: item.locked ? true : state.selectAllStruct,
                selectAllAttrs: state.selectAllStruct,
            }),
            state.structList
        );
        state.structAttrs = Dict.map(
            structAttrs => List.map(
                attr => ({
                    n: attr.n,
                    selected: state.selectAllStruct,
                }),
                structAttrs
            ),
            state.structAttrs
        );
    }

    private toggleAllStructureAttrs(state:CorpusViewOptionsModelState, structIdent:string):void {
        const struct = state.structList.find(item => item.n === structIdent);
        const structIdx = state.structList.indexOf(struct);

        struct.selectAllAttrs = !struct.selectAllAttrs;
        struct.selected = struct.selectAllAttrs;
        state.structList[structIdx] = struct;

        const structAttrs = state.structAttrs[structIdent];
        state.structAttrs[structIdent] = List.map(
            attr => ({
                n: attr.n,
                selected: struct.selectAllAttrs,
            }),
            structAttrs
        );
        state.selectAllStruct = this.hasSelectedAllStructs(state);
    }

    private toggleAllReferenceAttrs(state:CorpusViewOptionsModelState, categoryIdent:string):void {
        let reference = state.refList.find(item => item.n === categoryIdent);
        const index = state.refList.indexOf(reference);
        reference.selectAllAttrs = !reference.selectAllAttrs;
        reference.selected = reference.selectAllAttrs;
        state.refList[index] = reference;

        state.refAttrs[categoryIdent] = List.map(
            value => ({
                n: value.n,
                label: value.label,
                selected: reference.selectAllAttrs,
            }),
            state.refAttrs[categoryIdent]
        );
        state.selectAllRef = List.every(item => item.selectAllAttrs, state.refList);
    }

    private toggleAllReferences(state:CorpusViewOptionsModelState):void {
        state.selectAllRef = !state.selectAllRef;
        state.refList = List.map(
            item => ({
                label: item.label,
                n: item.n,
                selectAllAttrs: state.selectAllRef,
                selected: state.selectAllRef,
                locked: false,
            }),
            state.refList
        );
        state.refAttrs = Dict.map(
            item => List.map(
                value => ({
                    n: value.n,
                    label: value.label,
                    selected: state.selectAllRef
                }),
                item
            ),
            state.refAttrs
        );
    }

    private toggleReference(
        state:CorpusViewOptionsModelState,
        refIdent:string,
        refAttrIdent:string
    ):void {
        const refAttrs = state.refAttrs[refIdent];
        const reference = List.find(value => value.n === refIdent, state.refList);
        const index = List.findIndex(v => v.n === reference.n, state.refList);
        if (refAttrIdent === null) {
            reference.selected = !reference.selected;
            if (!reference.selected) {
                reference.selectAllAttrs = false;
                state.refAttrs[refIdent] = List.map(
                    item => ({
                        n: item.n,
                        selected: false,
                        label: item.label,
                    }),
                    refAttrs
                )
            }

        } else {
            state.refAttrs[refIdent] = List.map(
                item => item.n === refAttrIdent ?
                    {
                        label: item.label,
                        n: item.n,
                        selected: !item.selected
                    } :
                    item,
                refAttrs
            );
            reference.selected = List.some(
                value => value.selected,
                state.refAttrs[refIdent]
            );
            reference.selectAllAttrs = List.every(
                value => value.selected,
                state.refAttrs[refIdent]
            );
        }
        state.refList[index] = reference;
        state.selectAllRef = List.every(item => item.selectAllAttrs, state.refList);
    }

    private toggleAttribute(state:CorpusViewOptionsModelState, idx:number):void {
        const currItem = state.attrList[idx];
        state.attrList[idx] = {...currItem, selected: !currItem.selected};
        if (List.filter(v => v.selected, state.attrList).length === 0) {
            const srchIdx = List.findIndex(v => v.locked, state.attrList);
            if (srchIdx > -1) {
                const tmp = state.attrList[srchIdx];
                state.attrList[srchIdx] = {...tmp, selected: true};
            }
        }
        state.selectAllAttrs = List.every(attr => attr.selected, state.attrList);
    }

    private hasSelectedStructAttrs(state:CorpusViewOptionsModelState, structIdent:string):boolean {
        return List.find(item => item.selected, state.structAttrs[structIdent]) !== undefined;
    }

    private hasSelectedAllStructAttrs(
        state:CorpusViewOptionsModelState,
        structIdent:string
    ):boolean {
        return Dict.hasKey(structIdent, state.structAttrs) &&
            List.every(item => item.selected, state.structAttrs[structIdent]);
    }

    private hasSelectedAllStructs(state:CorpusViewOptionsModelState):boolean {
        return pipe(
            state.structAttrs,
            Dict.map(value => List.every(attr => attr.selected, value)),
            Dict.every(value => value)
        );
    }

    private clearStructAttrSelection(state:CorpusViewOptionsModelState, structIdent:string):void {
        if (Dict.hasKey(structIdent, state.structAttrs)) {
            state.structAttrs[structIdent] = List.map(
                item => ({
                    n: item.n,
                    selected: false
                }),
                state.structAttrs[structIdent]
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
    private toggleStructure(
        state:CorpusViewOptionsModelState,
        structIdent:string,
        structAttrIdent:string
    ):void {
        const struct = state.structList.find(item => item.n === structIdent);

        if (!struct) {
            throw new Error('structure not found: ' + structIdent);
        }
        const structIdx = state.structList.indexOf(struct);

        // first, test whether we operate with structattr
        if (structAttrIdent !== null) {
            const currStructAttrs = state.structAttrs[structIdent];
            const currStructAttr = List.find(item => item.n === structAttrIdent, currStructAttrs);
            let structAttrIdx;

            if (currStructAttr) {
                structAttrIdx = List.findIndex(v => v.n === currStructAttr.n, currStructAttrs);
                currStructAttrs[structAttrIdx] = {
                    n: currStructAttr.n,
                    selected: !currStructAttr.selected
                };
                state.structAttrs[structIdent] = currStructAttrs;
            }
            // now we have to process its parent struct according
            // to the rules 1 & 2
            if (structAttrIdx !== undefined) {
                const sel = state.structAttrs[structIdent][structAttrIdx].selected ?
                    true : this.hasSelectedStructAttrs(state, structIdent);

                state.structList[structIdx] = {
                    ...struct,
                    selected: sel,
                    selectAllAttrs: this.hasSelectedAllStructAttrs(state, structIdent),
                };
            }

        } else { // we are just changing a struct
            if (struct.selected) { // rule 4
                this.clearStructAttrSelection(state, structIdent);
            }
            state.structList[structIdx] = {
                ...struct,
                selected: !struct.selected,
                selectAllAttrs: false,
            };
        }
        state.selectAllStruct = this.hasSelectedAllStructs(state);
    }


    importData(state:CorpusViewOptionsModelState, data:ViewOptions.PageData):void {
        state.attrList = List.map(
            item => ({
                label: item.label,
                n: item.n,
                selected: data.CurrentAttrs.indexOf(item.n) > -1 ? true : false,
                locked: item.n === data.FixedAttr ? true : false,
            }),
            data.AttrList
        );
        state.structAttrs = pipe(
            data.StructAttrs,
            Dict.keys(),
            List.map(
                key => tuple(
                    key,
                    List.map(
                        structAttr => ({
                            n: structAttr,
                            selected: data.CurrStructAttrs.indexOf(key + '.' + structAttr) > -1
                        }),
                        data.StructAttrs[key]
                    )
                )
            ),
            Dict.fromEntries()
        );
        state.structList = pipe(
            data.AvailStructs,
            List.map(item => ({
                label: item.label,
                n: item.n,
                selected: item.sel === 'selected' ? true : false,
                locked: false,
                selectAllAttrs: this.hasSelectedAllStructAttrs(state, item.n),
            }))
        );
        List.forEach(
            struct => {
                if (!Dict.hasKey(struct.n, state.structAttrs)) {
                    state.structAttrs[struct.n] = [];
                }
            },
            data.AvailStructs
        );

        state.refAttrs = pipe(
            data.AvailRefs,
            List.groupBy(value => value.n.split('.')[0].replace('=', '')),
            List.map(([ident, item]) => tuple(
                ident,
                item.map(value => ({
                    n: value.n,
                    label: value.label,
                    selected: value.sel === 'selected' ? true : false
                }))
            )),
            Dict.fromEntries()
        );

        state.refList = pipe(
            state.refAttrs,
            Dict.keys(),
            List.map(value => ({
                label: value,
                n: value,
                selectAllAttrs: List.every(value => value.selected, state.refAttrs[value]),
                selected: List.some(value => value.selected, state.refAttrs[value]),
                locked: false,
            }))
        );

        state.selectAllRef = state.refList.every(item => item.selectAllAttrs);
        state.fixedAttr = data.FixedAttr;
        state.attrVmode = data.AttrVmode;
        state.hasLoadedData = true;
        state.showConcToolbar = data.ShowConcToolbar;
        state.baseViewAttr = data.BaseViewAttr;
        state.qsEnabled = data.QueryHintEnabled;
    }

    private loadData(state:CorpusViewOptionsModelState):Observable<ViewOptions.LoadOptionsResponse> {
        return this.layoutModel.ajax$<ViewOptions.LoadOptionsResponse>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl(
                'options/viewattrs', {corpname: state.corpusIdent.id}
            ),
            {}
        );
    }
}
