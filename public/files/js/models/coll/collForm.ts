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
import RSVP from 'rsvp';
import {StatefulModel} from '../base';
import {PageModel} from '../../app/main';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';
import {MultiDict} from '../../util';

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

/**
 *
 */
export class CollFormModel extends StatefulModel {

    private pageModel:PageModel;

    private attrList:Immutable.List<Kontext.AttrItem>;

    private cattr:string;

    private cfromw:Kontext.FormValue<string>;

    private ctow:Kontext.FormValue<string>;

    private cminfreq:Kontext.FormValue<string>;

    private cminbgr:Kontext.FormValue<string>;

    private cbgrfns:Immutable.Set<string>;

    private csortfn:string;


    constructor(dispatcher:ActionDispatcher, pageModel:PageModel, props:CollFormProps) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.attrList = Immutable.List<Kontext.AttrItem>(props.attrList);
        this.cattr = props.cattr;
        this.cfromw = {value: props.cfromw, isRequired: true, isInvalid: false};
        this.ctow = {value: props.ctow, isRequired: true, isInvalid: false};
        this.cminfreq = {value: props.cminfreq, isRequired: true, isInvalid: false};
        this.cminbgr = {value: props.cminbgr, isRequired: true, isInvalid: false};
        this.cbgrfns = Immutable.Set<string>(props.cbgrfns);
        this.csortfn = props.csortfn;

        dispatcher.register((payload:ActionPayload) => {
            switch (payload.actionType) {
                case 'COLL_FORM_SET_CATTR':
                    this.cattr = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'COLL_FORM_SET_CFROMW':
                    this.cfromw.value = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'COLL_FORM_SET_CTOW':
                    this.ctow.value = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'COLL_FORM_SET_CMINFREQ':
                    this.cminfreq.value = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'COLL_FORM_SET_CMINBGR':
                    this.cminbgr.value = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'COLL_FORM_SET_CBGRFNS':
                    if (this.cbgrfns.contains(payload.props['value'])) {
                        this.cbgrfns = this.cbgrfns.remove(payload.props['value']);

                    } else {
                        this.cbgrfns = this.cbgrfns.add(payload.props['value']);
                    }
                    this.notifyChangeListeners();
                break;
                case 'COLL_FORM_SET_CSORTFN':
                    this.csortfn = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'COLL_FORM_SUBMIT':
                    const err = this.validateForm();
                    if (err) {
                        this.pageModel.showMessage('error', err);
                        this.notifyChangeListeners();

                    } else {
                        this.submit();
                        // we leave the page here => no need to notify anybody
                    }
                break;
            }
        });
    }

    private validateForm():Error|null {
        if (this.validateNumber(this.cfromw.value)) {
            this.cfromw.isInvalid = false;

        } else {
            this.cfromw.isInvalid = true;
            return new Error(this.pageModel.translate('coll__invalid_number_value'));
        }
        if (this.validateNumber(this.ctow.value)) {
            this.ctow.isInvalid = false;

        } else {
            this.ctow.isInvalid = true;;
            return new Error(this.pageModel.translate('coll__invalid_number_value'));
        }
        if (this.validateGzNumber(this.cminfreq.value)) {
            this.cminfreq.isInvalid = false;

        } else {
            this.cminfreq.isInvalid = true;
            return new Error(this.pageModel.translate('coll__invalid_gz_number_value'));
        }
        if (this.validateGzNumber(this.cminbgr.value)) {
            this.cminbgr.isInvalid = false;

        } else {
            this.cminbgr.isInvalid = true;
            return new Error(this.pageModel.translate('coll__invalid_gz_number_value'));
        }
    }

    private validateNumber(s:string):boolean {
        return !!/^-?([1-9]\d*|0)?$/.exec(s);
    }

    private validateGzNumber(s:string):boolean {
        return !!/^([1-9]\d*)?$/.exec(s);
    }

    getSubmitArgs():MultiDict {
        const args = this.pageModel.getConcArgs();
        args.set('cattr', this.cattr);
        args.set('cfromw', this.cfromw);
        args.set('ctow', this.ctow);
        args.set('cminfreq', this.cminfreq);
        args.set('cminbgr', this.cminbgr);
        args.replace('cbgrfns', this.cbgrfns.toArray());
        args.set('csortfn', this.csortfn);
        return args;
    }

    private submit():void {
        window.location.href = this.pageModel.createActionUrl('collx', this.getSubmitArgs().items());
    }

    getAttrList():Immutable.List<Kontext.AttrItem> {
        return this.attrList;
    }

    getCattr():string {
        return this.cattr;
    }

    getCfromw():Kontext.FormValue<string> {
        return this.cfromw;
    }

    getCtow():Kontext.FormValue<string> {
        return this.ctow;
    }

    getCminfreq():Kontext.FormValue<string> {
        return this.cminfreq;
    }

    getCminbgr():Kontext.FormValue<string> {
        return this.cminbgr;
    }

    getCbgrfns():Immutable.Set<string> {
        return this.cbgrfns;
    }

    getCsortfn():string {
        return this.csortfn;
    }

    getAvailCbgrfns():Immutable.OrderedMap<string, string> {
        return Immutable.OrderedMap<string, string>([
            ['t', 'T-score'],
            ['m', 'MI'],
            ['3', 'MI3'],
            ['l', 'log likelihood'],
            ['s', 'min. sensitivity'],
            ['d', 'logDice'],
            ['p', 'MI.log_f'],
            ['r', 'relative freq.']
        ]);
    }
}
