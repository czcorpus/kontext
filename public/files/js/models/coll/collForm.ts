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

import { StatelessModel, IActionDispatcher } from 'kombo';

import { Kontext } from '../../types/common';
import { PageModel } from '../../app/page';
import { MultiDict } from '../../multidict';
import { Actions, ActionName } from './actions';
import { tuple, Dict, pipe, List } from 'cnc-tskit';
import { CollServerArgs } from './common';


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
    availCbgrfns:Array<[string, string]>;
    attrList:Array<Kontext.AttrItem>;
    cattr:string;
    cfromw:Kontext.FormValue<string>;
    ctow:Kontext.FormValue<string>;
    cminfreq:Kontext.FormValue<string>;
    cminbgr:Kontext.FormValue<string>;
    cbgrfns:{[key:string]:true};
    csortfn:string;
    isBusy:boolean;
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
                availCbgrfns: [
                    tuple('t', 'T-score'),
                    tuple('m', 'MI'),
                    tuple('3', 'MI3'),
                    tuple('l', 'log likelihood'),
                    tuple('s', 'min. sensitivity'),
                    tuple('d', 'logDice'),
                    tuple('p', 'MI.log_f'),
                    tuple('r', 'relative freq.')
                ],
                attrList: [...props.attrList],
                cattr: props.cattr,
                cfromw: {value: props.cfromw, isRequired: true, isInvalid: false},
                ctow: {value: props.ctow, isRequired: true, isInvalid: false},
                cminfreq: {value: props.cminfreq, isRequired: true, isInvalid: false},
                cminbgr: {value: props.cminbgr, isRequired: true, isInvalid: false},
                cbgrfns: pipe(
                    props.cbgrfns,
                    List.map<string, [string, true]>(v => tuple(v, true)),
                    Dict.fromEntries()
                ),
                csortfn: props.csortfn,
                isBusy: false
            }
        );
        this.pageModel = pageModel;

        this.addActionHandler<Actions.FormSetCattr>(
            ActionName.FormSetCattr,
            (state, action) => {
                state.cattr = action.payload.value;
            }
        );

        this.addActionHandler<Actions.FormSetCfromw>(
            ActionName.FormSetCfromw,
            (state, action) => {
                state.cfromw.value = action.payload.value;
            }
        );

        this.addActionHandler<Actions.FormSetCtow>(
            ActionName.FormSetCtow,
            (state, action) => {
                state.ctow.value = action.payload.value;
            }
        );

        this.addActionHandler<Actions.FormSetCminFreq>(
            ActionName.FormSetCminFreq,
            (state, action) => {
                state.cminfreq.value = action.payload.value;
            }
        );

        this.addActionHandler<Actions.FormSetCminbgr>(
            ActionName.FormSetCminbgr,
            (state, action) => {
                state.cminbgr.value = action.payload.value;
            }
        );

        this.addActionHandler<Actions.FormSetCbgrfns>(
            ActionName.FormSetCbgrfns,
            (state, action) => {
                if (Dict.hasKey(action.payload.value, state.cbgrfns)) {
                    if (state.csortfn !== action.payload.value) {
                        delete state.cbgrfns[action.payload.value];
                    }

                } else {
                    state.cbgrfns[action.payload.value] = true;
                }
            },
            (state, action, dispatch) => {
                if (state.csortfn === action.payload.value) {
                    this.pageModel.showMessage(
                        'error',
                        this.pageModel.translate('coll__form_sort_col_must_be_displayed')
                    );
                }
            }
        );

        this.addActionHandler<Actions.FormSetCsortfn>(
            ActionName.FormSetCsortfn,
            (state, action) => {
                state.csortfn = action.payload.value;
                if (!Dict.hasKey(state.csortfn, state.cbgrfns)) {
                    state.cbgrfns[state.csortfn] = true;
                }
            }
        );

        this.addActionHandler<Actions.FormSubmit>(
            ActionName.FormSubmit,
            (state, action) => {
                state.isBusy = true;
                this.validateForm(state);
            },
            (state, action, dispatch) => {
                if (this.hasErrorInputs(state)) {
                    this.pageModel.showMessage('error', this.pageModel.translate('global__the_form_contains_errors_msg'));

                } else {
                    this.submit(state);
                    // we leave the page here => no need to notify anybody
                }
            }
        );

        this.addActionHandler<Actions.ResultGetNextPage>(
            ActionName.ResultGetNextPage,
            null,
            (state, action, dispatch) => {
                dispatch<Actions.FormPrepareSubmitArgsDone>({
                    name: ActionName.FormPrepareSubmitArgsDone,
                    payload: {
                        args: this.getSubmitArgs(state)
                    }
                });
            }
        ).sideEffectAlsoOn(
            ActionName.ResultGetPrevPage,
            ActionName.ResultConfirmPageValue,
            ActionName.SaveFormSubmit,
            ActionName.ResultSortByColumn,
            ActionName.PopHistory,
            ActionName.ResultReload
        );
    }

    private validateForm(state:CollFormModelState):void {
        if (this.validateNumber(state.cfromw.value)) {
            state.cfromw.isInvalid = false;

        } else {
            state.cfromw.isInvalid = true;
            state.cfromw.errorDesc = this.pageModel.translate('coll__invalid_number_value');
        }

        if (this.validateNumber(state.ctow.value)) {
            state.ctow.isInvalid = false;

        } else {
            state.ctow.isInvalid = true;
            state.ctow.errorDesc = this.pageModel.translate('coll__invalid_number_value');
        }

        if (parseInt(state.cfromw.value) <= parseInt(state.ctow.value)) {
            state.cfromw.isInvalid = false;
            state.ctow.isInvalid = false;

        } else {
            state.cfromw.isInvalid = true;
            state.ctow.isInvalid = true;
            state.cfromw.errorDesc = this.pageModel.translate('coll__invalid_context_range');
            state.ctow.errorDesc = this.pageModel.translate('coll__invalid_context_range');
        }

        if (this.validateGzNumber(state.cminfreq.value)) {
            state.cminfreq.isInvalid = false;

        } else {
            state.cminfreq.isInvalid = true;
            state.cminfreq.errorDesc = this.pageModel.translate('coll__invalid_gz_number_value');
        }

        if (this.validateGzNumber(state.cminbgr.value)) {
            state.cminbgr.isInvalid = false;

        } else {
            state.cminbgr.isInvalid = true;
            state.cminbgr.errorDesc = this.pageModel.translate('coll__invalid_gz_number_value');
        }
    }

    private hasErrorInputs(state:CollFormModelState):boolean {
        return pipe(
            state,
            Dict.toEntries(),
            List.some(([,item]) => Kontext.isFormValue(item) && item.isInvalid)
        );
    }

    private validateNumber(s:string):boolean {
        return !!/^-?([1-9]\d*|0)?$/.exec(s);
    }

    private validateGzNumber(s:string):boolean {
        return !!/^([1-9]\d*)?$/.exec(s);
    }

    getSubmitArgs(state:CollFormModelState):MultiDict<CollServerArgs> {
        const args = this.pageModel.exportConcArgs() as MultiDict<CollServerArgs>;
        args.set('cattr', state.cattr);
        args.set('cfromw', state.cfromw.value);
        args.set('ctow', state.ctow.value);
        args.set('cminfreq', state.cminfreq.value);
        args.set('cminbgr', state.cminbgr.value);
        args.replace('cbgrfns', Dict.keys(state.cbgrfns));
        args.set('csortfn', state.csortfn);
        return args;
    }

    private submit(state:CollFormModelState):void {
        window.location.href = this.pageModel.createActionUrl('collx', this.getSubmitArgs(state).items());
    }
}
