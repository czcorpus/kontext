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

import {Kontext} from '../../types/common';
import {PageModel} from '../../app/page';
import { InputMode } from './common';
import {SubcorpFormModel} from './form';
import { MultiDict } from '../../multidict';
import { StatelessModel, IActionDispatcher, Action, SEDispatcher } from 'kombo';
import { throwError } from 'rxjs';
import { List, pipe } from 'cnc-tskit';
import { ActionName } from './actions';

/**
 *
 */
export class WithinLine {
    rowIdx:number;
    negated:boolean;
    structureName:string;
    attributeCql:Kontext.FormValue<string>;

    constructor(rowIdx:number, negated:boolean, structureName:string, attributeCql:Kontext.FormValue<string>) {
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
export class SubcorpWithinFormModel extends StatelessModel<SubcorpWithinFormModelState> {

    private pageModel:PageModel;

    private subcFormModel:SubcorpFormModel;

    constructor(dispatcher:IActionDispatcher, pageModel:PageModel, inputMode:InputMode,
            structsAndAttrs:Kontext.StructsAndAttrs, subcFormModel:SubcorpFormModel) {
        super(
            dispatcher,
            {
                lines: [new WithinLine(
                    0,
                    false,
                    Object.keys(structsAndAttrs).sort()[0],
                    {value: '', isRequired: true, isInvalid: false}
                )],
                lineIdGen: 0,
                inputMode: inputMode,
                structsAndAttrs: structsAndAttrs,
                helpHintVisible: false
            }
        );
        this.pageModel = pageModel;
        this.subcFormModel = subcFormModel;
    }


    reduce(state:SubcorpWithinFormModelState, action:Action):SubcorpWithinFormModelState {
        let newState:SubcorpWithinFormModelState;

        switch (action.name) {
            case ActionName.FormSetInputMode:
                newState = this.copyState(state);
                newState.inputMode = action.payload['value'];
            break;
            case 'SUBCORP_FORM_WITHIN_LINE_ADDED':
                newState = this.copyState(state);
                this.addLine(
                    newState,
                    action.payload['structureName'],
                    action.payload['negated'],
                    action.payload['attributeCql']
                );
            break;
            case 'SUBCORP_FORM_WITHIN_LINE_SET_WITHIN_TYPE':
                newState = this.copyState(state);
                this.updateWithinType(newState, action.payload['rowIdx'], action.payload['value']);
            break;
            case 'SUBCORP_FORM_WITHIN_LINE_SET_STRUCT':
                newState = this.copyState(state);
                this.updateStruct(newState, action.payload['rowIdx'], action.payload['value']);
            break;
            case 'SUBCORP_FORM_WITHIN_LINE_SET_CQL':
                newState = this.copyState(state);
                this.updateCql(newState, action.payload['rowIdx'], action.payload['value']);
            break;
            case 'SUBCORP_FORM_WITHIN_LINE_REMOVED':
                newState = this.copyState(state);
                this.removeLine(newState, action.payload['rowIdx']);
            break;
            case 'SUBCORP_FORM_SHOW_RAW_WITHIN_HINT':
                newState = this.copyState(state);
                newState.helpHintVisible = true;
            break;
            case 'SUBCORP_FORM_HIDE_RAW_WITHIN_HINT':
                newState = this.copyState(state);
                newState.helpHintVisible = false;
            break;
            default:
                newState = state;
        }
        return newState;
    }

    sideEffects(state:SubcorpWithinFormModelState, action:Action, dispatch:SEDispatcher):void {
        switch (action.name) {
            case ActionName.FormSubmit:
                if (state.inputMode === InputMode.RAW) {
                    const args = this.getSubmitArgs(state);
                    const err = this.validateForm(state);
                    (err === null ?
                        this.pageModel.ajax$<any>(
                            'POST',
                            this.pageModel.createActionUrl('/subcorpus/subcorp', [['format', 'json']]),
                            args
                        ) :
                        throwError(err)

                    ).subscribe(
                        () => {
                            window.location.href = this.pageModel.createActionUrl('subcorpus/subcorp_list');
                        },
                        (err) => {
                            this.pageModel.showMessage('error', err);
                        }
                    );
                }
            break;
        }
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

    addLine(state:SubcorpWithinFormModelState, structName:string, negated:boolean, cql:string):void {
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

    private getSubmitArgs(state:SubcorpWithinFormModelState):MultiDict {
        const args = new MultiDict();
        args.set('corpname', this.subcFormModel.getCorpname());
        args.set('subcname', this.subcFormModel.getSubcname().value);
        args.set('publish', this.subcFormModel.getIsPublic() ? '1' : '0');
        args.set('description', this.subcFormModel.getDescription().value);
        args.set('method', state.inputMode);
        const alignedCorpora = List.map(v => v.value, this.subcFormModel.getAlignedCorpora());
        if (alignedCorpora.length > 0) {
            args.replace('aligned_corpora', List.map(v => v.value, this.subcFormModel.getAlignedCorpora()));
            args.set('attrs', JSON.stringify(this.subcFormModel.getTTSelections()));
        }
        args.set(
            'within_json',
            JSON.stringify(pipe(
                state.lines,
                List.filter((v)=>v != null),
                List.map((v:WithinLine) => ({
                    negated: v.negated,
                    structure_name: v.structureName,
                    attribute_cql: v.attributeCql.value
                }))
            ))
        );
        return args;
    }

}