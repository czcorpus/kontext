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
import { CreateSubcorpusWithinArgs, InputMode } from './common';
import { SubcorpFormModel } from './form';
import { StatelessModel, IActionDispatcher } from 'kombo';
import { throwError } from 'rxjs';
import { List, pipe, HTTP, tuple, Dict } from 'cnc-tskit';
import { Actions } from './actions';
import { Actions as GlobalActions } from '../common/actions';
import { IUnregistrable } from '../common/common';

/**
 *
 */
export class WithinLine {
    rowIdx:number;
    negated:boolean;
    structureName:string;
    attributeCql:Kontext.FormValue<string>;

    constructor(
        rowIdx:number,
        negated:boolean,
        structureName:string,
        attributeCql:Kontext.FormValue<string>
    ) {

        this.rowIdx = rowIdx;
        this.negated = negated;
        this.structureName = structureName;
        this.attributeCql = attributeCql;
    }
}


/**
 *
 */
export interface SubcorpWithinFormModelState {
    lines:Array<WithinLine>;
    lineIdGen:number;
    inputMode:InputMode;
    structsAndAttrs:Kontext.StructsAndAttrs;
    helpHintVisible:boolean;
}

/**
 *
 */
export class SubcorpWithinFormModel extends StatelessModel<SubcorpWithinFormModelState> implements IUnregistrable {

    private pageModel:PageModel;

    private subcFormModel:SubcorpFormModel;

    constructor(
        dispatcher:IActionDispatcher,
        pageModel:PageModel,
        inputMode:InputMode,
        structsAndAttrs:Kontext.StructsAndAttrs,
        subcFormModel:SubcorpFormModel
    ) {
        super(
            dispatcher,
            {
                lines: [new WithinLine(
                    0,
                    false,
                    pipe(
                        structsAndAttrs,
                        Dict.keys(),
                        List.sortedAlphaBy(v => v),
                        List.head()
                    ),
                    {value: '', isRequired: true, isInvalid: false}
                )],
                lineIdGen: 0,
                inputMode,
                structsAndAttrs,
                helpHintVisible: false
            }
        );
        this.pageModel = pageModel;
        this.subcFormModel = subcFormModel;

        this.addActionHandler<typeof Actions.FormSetInputMode>(
            Actions.FormSetInputMode.name,
            (state, action) => {
                state.inputMode = action.payload.value;
            }
        );

        this.addActionHandler<typeof Actions.FormWithinLineAdded>(
            Actions.FormWithinLineAdded.name,
            (state, action) => {
                this.addLine(
                    state,
                    action.payload.structureName,
                    action.payload.negated,
                    action.payload.attributeCql
                );
            }
        );

        this.addActionHandler<typeof Actions.FormWithinLineSetType>(
            Actions.FormWithinLineSetType.name,
            (state, action) => {
                this.updateWithinType(state, action.payload.rowIdx, action.payload.value);
            }
        );

        this.addActionHandler<typeof Actions.FormWithinLineSetStruct>(
            Actions.FormWithinLineSetStruct.name,
            (state, action) => {
                this.updateStruct(state, action.payload.rowIdx, action.payload.value);
            }
        );

        this.addActionHandler<typeof Actions.FormWithinLineSetCQL>(
            Actions.FormWithinLineSetCQL.name,
            (state, action) => {
                this.updateCql(state, action.payload.rowIdx, action.payload.value);
            }
        );

        this.addActionHandler<typeof Actions.FormWithinLineRemoved>(
            Actions.FormWithinLineRemoved.name,
            (state, action) => {
                this.removeLine(state, action.payload.rowIdx);
            }
        );

        this.addActionHandler<typeof Actions.FormShowRawWithinHint>(
            Actions.FormShowRawWithinHint.name,
            (state, action) => {
                state.helpHintVisible = true;
            }
        );

        this.addActionHandler<typeof Actions.FormHideRawWithinHint>(
            Actions.FormHideRawWithinHint.name,
            (state, action) => {
                state.helpHintVisible = false;
            }
        );

        this.addActionHandler<typeof Actions.FormSubmit>(
            Actions.FormSubmit.name,
            null,
            (state, action, dispatch) => {
                if (state.inputMode === 'within') {
                    const args = this.getSubmitArgs(state);
                    const err = this.validateForm(state);
                    (err === null ?
                        this.pageModel.ajax$<any>(
                            HTTP.Method.POST,
                            this.pageModel.createActionUrl(
                                '/subcorpus/create',
                                {format: 'json'}
                            ),
                            args,
                            {
                                contentType: 'application/json'
                            }
                        ) :
                        throwError(err)

                    ).subscribe({
                        next: () => {
                            window.location.href = this.pageModel.createActionUrl(
                                'subcorpus/list');
                        },
                        error: error => {
                            this.pageModel.showMessage('error', error);
                        }
                    });
                }
            }
        );

        this.addActionHandler<typeof GlobalActions.SwitchCorpus>(
            GlobalActions.SwitchCorpus.name,
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
            state.lines[srchIdx] = new WithinLine(
                srchIdx,
                negated,
                state.lines[srchIdx].structureName,
                state.lines[srchIdx].attributeCql
            );
        }
    }

    updateStruct(state:SubcorpWithinFormModelState, rowIdx, structName) {
        const srchIdx = List.findIndex(v => v.rowIdx === rowIdx, state.lines);
        if (srchIdx > -1) {
            state.lines[srchIdx] = new WithinLine(
                srchIdx,
                state.lines[srchIdx].negated,
                structName,
                state.lines[srchIdx].attributeCql
            );
        }
    }

    updateCql(state:SubcorpWithinFormModelState, rowIdx, cql) {
        const srchIdx = List.findIndex(v => v.rowIdx === rowIdx, state.lines);
        if (srchIdx > -1) {
            state.lines[srchIdx] = new WithinLine(
                srchIdx,
                state.lines[srchIdx].negated,
                state.lines[srchIdx].structureName,
                {value: cql, isRequired: true, isInvalid: false}
            );
        }
    }

    addLine(
        state:SubcorpWithinFormModelState,
        structName:string,
        negated:boolean,
        cql:string
    ):void {
        state.lineIdGen += 1;
        state.lines.push(new WithinLine(
            state.lineIdGen,
            negated,
            structName,
            {value: cql, isRequired: true, isInvalid: false}
        ));
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

    validateForm(state:SubcorpWithinFormModelState):Error|null {
        const errIdx = List.findIndex(v => v.attributeCql.value === '', state.lines);
        if (errIdx > -1) {
            const curr = state.lines[errIdx];
            state.lines[errIdx] = new WithinLine(
                curr.rowIdx,
                curr.negated,
                curr.structureName,
                Kontext.updateFormValue(curr.attributeCql, {isInvalid: true})
            );
            return new Error(this.pageModel.translate('subcform__cql_cannot_be_empty'));
        }
        return null;
    }

    private getSubmitArgs(state:SubcorpWithinFormModelState):CreateSubcorpusWithinArgs {
        return {
            corpname: this.subcFormModel.getCorpname(),
            subcname: this.subcFormModel.getSubcname().value,
            publish: this.subcFormModel.getIsPublic(),
            description: this.subcFormModel.getDescription().value,
            within: pipe(
                state.lines,
                List.filter((v)=>v != null),
                List.map((v:WithinLine) => ({
                    negated: v.negated,
                    structure_name: v.structureName,
                    attribute_cql: v.attributeCql.value
                }))
            ),
            form_type:'within'
        };
    }

}