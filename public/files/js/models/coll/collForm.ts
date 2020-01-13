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
import * as Immutable from 'immutable';
import {PageModel} from '../../app/page';
import {MultiDict} from '../../util';
import { StatelessModel, IActionDispatcher } from 'kombo';

/**
 *
 */
export interface CollFormInputs {
    cattr:string;
    cfromw:string;
    ctow:string;
    cminfreq:string;
    cminbgr:string;
    cbgrfns:Array<string>;
    csortfn:string;
}

/**
 *
 */
export interface CollFormProps extends CollFormInputs {
    attrList:Array<Kontext.AttrItem>;
}

export interface CollFormModelState {
    availCbgrfns:Immutable.OrderedMap<string, string>;
    attrList:Immutable.List<Kontext.AttrItem>;
    cattr:string;
    cfromw:Kontext.FormValue<string>;
    ctow:Kontext.FormValue<string>;
    cminfreq:Kontext.FormValue<string>;
    cminbgr:Kontext.FormValue<string>;
    cbgrfns:Immutable.Set<string>;
    csortfn:string;
}

/**
 *
 */
export class CollFormModel extends StatelessModel<CollFormModelState> {

    private pageModel:PageModel;

    constructor(dispatcher:IActionDispatcher, pageModel:PageModel, props:CollFormProps) {
        super(
            dispatcher,
            {
                availCbgrfns: Immutable.OrderedMap<string, string>([
                    ['t', 'T-score'],
                    ['m', 'MI'],
                    ['3', 'MI3'],
                    ['l', 'log likelihood'],
                    ['s', 'min. sensitivity'],
                    ['d', 'logDice'],
                    ['p', 'MI.log_f'],
                    ['r', 'relative freq.']
                ]),
                attrList: Immutable.List<Kontext.AttrItem>(props.attrList),
                cattr: props.cattr,
                cfromw: {value: props.cfromw, isRequired: true, isInvalid: false},
                ctow: {value: props.ctow, isRequired: true, isInvalid: false},
                cminfreq: {value: props.cminfreq, isRequired: true, isInvalid: false},
                cminbgr: {value: props.cminbgr, isRequired: true, isInvalid: false},
                cbgrfns: Immutable.Set<string>(props.cbgrfns),
                csortfn: props.csortfn
            }
        );
        this.pageModel = pageModel;
    }

    reduce(state, action):CollFormModelState {
        let newState:CollFormModelState;

        switch (action.name) {
            case 'COLL_FORM_SET_CATTR':
                newState = this.copyState(state);
                newState.cattr = action.payload['value'];
                return newState;
            case 'COLL_FORM_SET_CFROMW':
                newState = this.copyState(state);
                newState.cfromw.value = action.payload['value'];
                return newState;
            case 'COLL_FORM_SET_CTOW':
                newState = this.copyState(state);
                newState.ctow.value = action.payload['value'];
                return newState;
            case 'COLL_FORM_SET_CMINFREQ':
                newState = this.copyState(state);
                newState.cminfreq.value = action.payload['value'];
                return newState;
            case 'COLL_FORM_SET_CMINBGR':
                newState = this.copyState(state);
                newState.cminbgr.value = action.payload['value'];
                return newState;
            case 'COLL_FORM_SET_CBGRFNS':
                newState = this.copyState(state);
                if (newState.cbgrfns.contains(action.payload['value'])) {
                    if (newState.csortfn === action.payload['value']) {
                        this.pageModel.showMessage(
                            'error',
                            this.pageModel.translate('coll__form_sort_col_must_be_displayed')
                        );

                    } else {
                        newState.cbgrfns = newState.cbgrfns.remove(action.payload['value']);
                    }

                } else {
                    newState.cbgrfns = newState.cbgrfns.add(action.payload['value']);
                }
                return newState;
            case 'COLL_FORM_SET_CSORTFN':
                newState = this.copyState(state);
                newState.csortfn = action.payload['value'];
                if (!newState.cbgrfns.contains(newState.csortfn)) {
                    newState.cbgrfns = newState.cbgrfns.add(newState.csortfn);
                }
                return newState;
            case 'COLL_FORM_SUBMIT':
                newState = this.copyState(state);
                const err = this.validateForm(newState);
                if (err) {
                    this.pageModel.showMessage('error', err);
                    return newState;

                } else {
                    this.submit(newState);
                    // we leave the page here => no need to notify anybody
                }
            default:
                return state;
        }
    }

    private validateForm(state:CollFormModelState):Error|null {
        if (this.validateNumber(state.cfromw.value)) {
            state.cfromw.isInvalid = false;

        } else {
            state.cfromw.isInvalid = true;
            return new Error(this.pageModel.translate('coll__invalid_number_value'));
        }

        if (this.validateNumber(state.ctow.value)) {
            state.ctow.isInvalid = false;

        } else {
            state.ctow.isInvalid = true;
            return new Error(this.pageModel.translate('coll__invalid_number_value'));
        }

        if (parseInt(state.cfromw.value) <= parseInt(state.ctow.value)) {
            state.cfromw.isInvalid = false;
            state.ctow.isInvalid = false;

        } else {
            state.cfromw.isInvalid = true;
            state.ctow.isInvalid = true;
            return new Error(this.pageModel.translate('coll__invalid_context_range'));
        }

        if (this.validateGzNumber(state.cminfreq.value)) {
            state.cminfreq.isInvalid = false;

        } else {
            state.cminfreq.isInvalid = true;
            return new Error(this.pageModel.translate('coll__invalid_gz_number_value'));
        }

        if (this.validateGzNumber(state.cminbgr.value)) {
            state.cminbgr.isInvalid = false;

        } else {
            state.cminbgr.isInvalid = true;
            return new Error(this.pageModel.translate('coll__invalid_gz_number_value'));
        }
    }

    private validateNumber(s:string):boolean {
        return !!/^-?([1-9]\d*|0)?$/.exec(s);
    }

    private validateGzNumber(s:string):boolean {
        return !!/^([1-9]\d*)?$/.exec(s);
    }

    getSubmitArgs(state:CollFormModelState):MultiDict {
        const args = this.pageModel.getConcArgs();
        args.set('cattr', state.cattr);
        args.set('cfromw', state.cfromw.value);
        args.set('ctow', state.ctow.value);
        args.set('cminfreq', state.cminfreq.value);
        args.set('cminbgr', state.cminbgr.value);
        args.replace('cbgrfns', state.cbgrfns.toArray());
        args.set('csortfn', state.csortfn);
        return args;
    }

    private submit(state:CollFormModelState):void {
        window.location.href = this.pageModel.createActionUrl('collx', this.getSubmitArgs(state).items());
    }
}
