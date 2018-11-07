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
import {StatelessModel} from '../base';
import * as Immutable from 'immutable';
import {PageModel} from '../../app/main';
import {ActionDispatcher, ActionPayload, SEDispatcher} from '../../app/dispatcher';
import { InputMode } from './common';
import {SubcorpFormModel} from './form';
import { MultiDict } from '../../util';
import RSVP from 'rsvp';

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
    lines:Immutable.List<WithinLine>;
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

    constructor(dispatcher:ActionDispatcher, pageModel:PageModel, inputMode:InputMode,
            structsAndAttrs:Kontext.StructsAndAttrs, subcFormModel:SubcorpFormModel) {
        super(
            dispatcher,
            {
                lines: Immutable.List<WithinLine>().push(new WithinLine(
                    0,
                    false,
                    Object.keys(structsAndAttrs).sort()[0],
                    {value: '', isRequired: true, isInvalid: false}
                )),
                lineIdGen: 0,
                inputMode: inputMode,
                structsAndAttrs: structsAndAttrs,
                helpHintVisible: false
            }
        );
        this.pageModel = pageModel;
        this.subcFormModel = subcFormModel;
    }


    reduce(state:SubcorpWithinFormModelState, action:ActionPayload):SubcorpWithinFormModelState {
        let newState:SubcorpWithinFormModelState;

        switch (action.actionType) {
            case 'SUBCORP_FORM_SET_INPUT_MODE':
                newState = this.copyState(state);
                newState.inputMode = action.props['value'];
            break;
            case 'SUBCORP_FORM_WITHIN_LINE_ADDED':
                newState = this.copyState(state);
                this.addLine(
                    newState,
                    action.props['structureName'],
                    action.props['negated'],
                    action.props['attributeCql']
                );
            break;
            case 'SUBCORP_FORM_WITHIN_LINE_SET_WITHIN_TYPE':
                newState = this.copyState(state);
                this.updateWithinType(newState, action.props['rowIdx'], action.props['value']);
            break;
            case 'SUBCORP_FORM_WITHIN_LINE_SET_STRUCT':
                newState = this.copyState(state);
                this.updateStruct(newState, action.props['rowIdx'], action.props['value']);
            break;
            case 'SUBCORP_FORM_WITHIN_LINE_SET_CQL':
                newState = this.copyState(state);
                this.updateCql(newState, action.props['rowIdx'], action.props['value']);
            break;
            case 'SUBCORP_FORM_WITHIN_LINE_REMOVED':
                newState = this.copyState(state);
                this.removeLine(newState, action.props['rowIdx']);
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

    sideEffects(state:SubcorpWithinFormModelState, action:ActionPayload, dispatch:SEDispatcher):void {
        switch (action.actionType) {
            case 'SUBCORP_FORM_SUBMIT':
                if (state.inputMode === InputMode.RAW) {
                    const args = this.getSubmitArgs(state);
                    const err = this.validateForm(state);
                    (() => {
                        if (err === null) {
                            return this.pageModel.ajax<any>(
                                'POST',
                                this.pageModel.createActionUrl('/subcorpus/subcorp'),
                                args
                            );

                        } else {
                            return RSVP.Promise.reject(err);
                        }
                    })().then(
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
        const srchIdx = state.lines.findIndex(v => v.rowIdx === rowIdx);
        if (srchIdx > -1) {
            state.lines = state.lines.set(srchIdx, new WithinLine(
                srchIdx,
                negated,
                state.lines.get(srchIdx).structureName,
                state.lines.get(srchIdx).attributeCql
            ));
        }
    }

    updateStruct(state:SubcorpWithinFormModelState, rowIdx, structName) {
        const srchIdx = state.lines.findIndex(v => v.rowIdx === rowIdx);
        if (srchIdx > -1) {
            state.lines = state.lines.set(srchIdx, new WithinLine(
                srchIdx,
                state.lines.get(srchIdx).negated,
                structName,
                state.lines.get(srchIdx).attributeCql
            ));
        }
    }

    updateCql(state:SubcorpWithinFormModelState, rowIdx, cql) {
        const srchIdx = state.lines.findIndex(v => v.rowIdx === rowIdx);
        if (srchIdx > -1) {
            state.lines = state.lines.set(srchIdx, new WithinLine(
                srchIdx,
                state.lines.get(srchIdx).negated,
                state.lines.get(srchIdx).structureName,
                {value: cql, isRequired: true, isInvalid: false}
            ));
        }
    }

    addLine(state:SubcorpWithinFormModelState, structName:string, negated:boolean, cql:string):void {
        state.lineIdGen += 1;
        state.lines = state.lines.push(new WithinLine(
            state.lineIdGen,
            negated,
            structName,
            {value: cql, isRequired: true, isInvalid: false}
        ));
    }

    removeLine(state:SubcorpWithinFormModelState, rowIdx:number) {
        const srch = state.lines.findIndex(v => v.rowIdx === rowIdx);
        if (srch > -1) {
            state.lines = state.lines.remove(srch);
        }
    }

    exportCql(state:SubcorpWithinFormModelState):string {
        return state.lines.filter((v)=>v != null).map(
            (v:WithinLine) => (
                (v.negated ? '!within' : 'within') + ' <' + v.structureName
                    + ' ' + v.attributeCql.value + ' />')
        ).join(' ');
    }

    validateForm(state:SubcorpWithinFormModelState):Error|null {
        const errIdx = state.lines.findIndex(v => v.attributeCql.value === '');
        if (errIdx > -1) {
            const curr = state.lines.get(errIdx);
            state.lines = state.lines.set(errIdx, new WithinLine(
                curr.rowIdx,
                curr.negated,
                curr.structureName,
                Kontext.updateFormValue(curr.attributeCql, {isInvalid: true})
            ));
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
        args.set('format', 'json');
        const alignedCorpora = this.subcFormModel.getAlignedCorpora().map(v => v.value).toArray();
        if (alignedCorpora.length > 0) {
            args.replace('aligned_corpora', this.subcFormModel.getAlignedCorpora().map(v => v.value).toArray());
            args.set('attrs', JSON.stringify(this.subcFormModel.getTTSelections()));
        }
        args.set(
            'within_json',
            JSON.stringify(state.lines.filter((v)=>v != null).map(
                (v:WithinLine) => ({
                    negated: v.negated,
                    structure_name: v.structureName,
                    attribute_cql: v.attributeCql.value
                })
            ))
        );
        return args;
    }

}