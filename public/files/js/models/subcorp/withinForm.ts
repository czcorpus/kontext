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

import * as Kontext from '../../types/kontext';
import { PageModel } from '../../app/page';
import { FormType, isServerWithinSelection, ServerWithinSelection } from './common';
import { StatelessModel, IActionDispatcher } from 'kombo';
import { List, pipe, Dict } from 'cnc-tskit';
import { Actions } from './actions';
import { Actions as GlobalActions } from '../common/actions';
import { IUnregistrable } from '../common/common';

/**
 *
 */
export interface WithinLine {
    rowIdx:number;
    negated:boolean;
    structureName:string;
    attributeCql:Kontext.FormValue<string>;
}


/**
 *
 */
export interface SubcorpWithinFormModelState {
    lines:Array<WithinLine>;
    lineIdGen:number;
    inputMode:FormType;
    structsAndAttrs:Kontext.StructsAndAttrs;
    helpHintVisible:boolean;
}

/**
 *
 */
export class SubcorpWithinFormModel extends StatelessModel<SubcorpWithinFormModelState> implements IUnregistrable {

    private pageModel:PageModel;

    constructor(
        dispatcher:IActionDispatcher,
        pageModel:PageModel,
        inputMode:FormType,
        structsAndAttrs:Kontext.StructsAndAttrs,
        initialLines?:Array<ServerWithinSelection>,
    ) {
        super(
            dispatcher,
            {
                lines: initialLines ?
                    List.map((item, rowIdx) => ({
                        rowIdx,
                        negated: item.negated,
                        structureName: item.structure_name,
                        attributeCql: {value: item.attribute_cql, isRequired: true, isInvalid: false},
                    }), initialLines) :
                    Dict.empty(structsAndAttrs) ?
                    [] :
                    [
                        {
                            rowIdx: 0,
                            negated: false,
                            structureName: pipe(
                                structsAndAttrs,
                                Dict.keys(),
                                List.sortedAlphaBy(v => v),
                                List.head()
                            ),
                            attributeCql: { value: '', isRequired: true, isInvalid: false }
                        }
                    ],
                lineIdGen: 0,
                inputMode,
                structsAndAttrs,
                helpHintVisible: false
            }
        );
        this.pageModel = pageModel;

        this.addActionHandler(
            Actions.FormSetInputMode,
            (state, action) => {
                state.inputMode = action.payload.value;
            }
        );

        this.addActionHandler(
            Actions.FormWithinLineAdded,
            (state, action) => {
                this.addLine(
                    state,
                    action.payload.structureName,
                    action.payload.negated,
                    action.payload.attributeCql
                );
            }
        );

        this.addActionHandler(
            Actions.FormWithinLineSetType,
            (state, action) => {
                this.updateWithinType(state, action.payload.rowIdx, action.payload.value);
            }
        );

        this.addActionHandler(
            Actions.FormWithinLineSetStruct,
            (state, action) => {
                this.updateStruct(state, action.payload.rowIdx, action.payload.value);
            }
        );

        this.addActionHandler(
            Actions.FormWithinLineSetCQL,
            (state, action) => {
                this.updateCql(state, action.payload.rowIdx, action.payload.value);
            }
        );

        this.addActionHandler(
            Actions.FormWithinLineRemoved,
            (state, action) => {
                this.removeLine(state, action.payload.rowIdx);
            }
        );

        this.addActionHandler(
            Actions.FormShowRawWithinHint,
            (state, action) => {
                state.helpHintVisible = true;
            }
        );

        this.addActionHandler(
            Actions.FormHideRawWithinHint,
            (state, action) => {
                state.helpHintVisible = false;
            }
        );

        this.addActionHandler(
            Actions.FormSubmit,
            (state, action) => {
                this.validateForm(state);
            },
            (state, action, dispatch) => {
                dispatch(
                    Actions.FormWithinSubmitArgsReady,
                    {
                        data: this.getSubmitArgs(state),
                        firstValidationError: this.getFirstInputError(state)
                    }
                );
            }
        );

        this.addActionHandler(
            Actions.ReuseQuery,
            (state, action) => {
                this.validateForm(state);
            },
            (state, action, dispatch) => {
                dispatch(
                    Actions.FormWithinSubmitArgsReady,
                    {
                        data: this.getSubmitArgs(state),
                        firstValidationError: this.getFirstInputError(state)
                    }
                );
            }
        );

        this.addActionHandler(
            Actions.LoadSubcorpusDone,
            (state, action) => {
                state.structsAndAttrs = action.payload?.structsAndAttrs;
                if (!action.error && isServerWithinSelection(action.payload?.data.selections)) {
                    state.lines = List.map(
                        (item, rowIdx) => ({
                            rowIdx,
                            attributeCql: Kontext.newFormValue(item.attribute_cql, true),
                            negated: item.negated,
                            structureName: item.structure_name
                        }),
                        action.payload?.data.selections
                    )
                }
            }
        )

        this.addActionHandler(
            GlobalActions.SwitchCorpus,
            null,
            (state, action, dispatch) => {
                dispatch<typeof GlobalActions.SwitchCorpusReady>({
                    name: GlobalActions.SwitchCorpusReady.name,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: {}
                    }
                });
            }
        );
    }

    getRegistrationId():string {
        return 'subcorp-within-form-model';
    }

    updateWithinType(state:SubcorpWithinFormModelState, rowIdx, negated) {
        const srchIdx = List.findIndex(v => v.rowIdx === rowIdx, state.lines);
        if (srchIdx > -1) {
            state.lines[srchIdx] = {
                rowIdx: srchIdx,
                negated,
                structureName: state.lines[srchIdx].structureName,
                attributeCql: state.lines[srchIdx].attributeCql
            };
        }
    }

    updateStruct(state:SubcorpWithinFormModelState, rowIdx, structName) {
        const srchIdx = List.findIndex(v => v.rowIdx === rowIdx, state.lines);
        if (srchIdx > -1) {
            state.lines[srchIdx] = {
                rowIdx: srchIdx,
                negated: state.lines[srchIdx].negated,
                structureName:  structName,
                attributeCql: state.lines[srchIdx].attributeCql
            };
        }
    }

    updateCql(state:SubcorpWithinFormModelState, rowIdx, cql) {
        const srchIdx = List.findIndex(v => v.rowIdx === rowIdx, state.lines);
        if (srchIdx > -1) {
            state.lines[srchIdx] = {
                rowIdx: srchIdx,
                negated: state.lines[srchIdx].negated,
                structureName: state.lines[srchIdx].structureName,
                attributeCql: {value: cql, isRequired: true, isInvalid: false}
            };
        }
    }

    addLine(
        state:SubcorpWithinFormModelState,
        structName:string,
        negated:boolean,
        cql:string
    ):void {
        state.lineIdGen += 1;
        state.lines.push({
            rowIdx: state.lineIdGen,
            negated,
            structureName: structName,
            attributeCql: {value: cql, isRequired: true, isInvalid: false}
        });
    }

    removeLine(state:SubcorpWithinFormModelState, rowIdx:number) {
        const srch = List.findIndex(v => v.rowIdx === rowIdx, state.lines);
        if (srch > -1) {
            state.lines = List.removeAt(srch, state.lines);
        }
    }

    exportCql(state:SubcorpWithinFormModelState):string {
        return pipe(
            state.lines,
            List.filter((v)=>v != null),
            List.map((v:WithinLine) =>
                `${v.negated ? '!within' : 'within'} <${v.structureName} ${v.attributeCql.value} />`
            )
        ).join(' ');
    }

    validateForm(state:SubcorpWithinFormModelState):void {
        const errIdx = List.findIndex(v => v.attributeCql.value === '', state.lines);
        if (errIdx > -1) {
            const curr = state.lines[errIdx];
            state.lines[errIdx] = {
                rowIdx: curr.rowIdx,
                negated: curr.negated,
                structureName: curr.structureName,
                attributeCql: Kontext.updateFormValue(
                    curr.attributeCql,
                    {
                        isInvalid: true,
                        errorDesc: this.pageModel.translate('subcform__cql_cannot_be_empty')
                    }
                )
            };
        }
    }

    private getFirstInputError(state:SubcorpWithinFormModelState):string|undefined {
        const srch = List.find(
            x => x.attributeCql.isInvalid,
            state.lines
        );
        return srch ? srch.attributeCql.errorDesc : undefined
    }

    private getSubmitArgs(
        state:SubcorpWithinFormModelState
    ):Array<ServerWithinSelection> {
        return pipe(
            state.lines,
            List.filter((v)=>v != null),
            List.map((v:WithinLine) => ({
                negated: v.negated,
                structure_name: v.structureName,
                attribute_cql: v.attributeCql.value
            }))
        );
    }

}