/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

/// <reference path="../../types/common.d.ts" />
/// <reference path="../../../ts/declarations/immutable.d.ts" />
/// <reference path="../../types/ajaxResponses.d.ts" />

import {SimplePageStore} from '../base';
import {PageModel} from '../../tpl/document';
import * as Immutable from 'vendor/immutable';
import * as RSVP from 'vendor/rsvp';
import {MultiDict} from '../../util';


const sortAttrVals = (x1:Kontext.AttrItem, x2:Kontext.AttrItem) => {
    if (x1.label < x2.label) {
        return -1;
    }
    if (x1.label > x2.label) {
        return 1;
    }
    return 0;
};


export interface ContingencyTableFormProperties {
    attrList:Array<Kontext.AttrItem>;
    structAttrList:Array<Kontext.AttrItem>;
    attr1:string;
    attr2:string;
}


type Data2DTable = {[d1:string]:{[d2:string]:number}};


/**
 *
 */
export class ContingencyTableStore extends SimplePageStore {

    private pageModel:PageModel;

    private availAttrList:Immutable.List<Kontext.AttrItem>;

    private availStructAttrList:Immutable.List<Kontext.AttrItem>;

    private attr1:string;

    private attr2:string;

    private data:Data2DTable;

    private d1Labels:Immutable.List<string>;

    private d2Labels:Immutable.List<string>;

    private colorStepFn:(v:number)=>number;


    constructor(dispatcher:Kontext.FluxDispatcher, pageModel:PageModel, props:ContingencyTableFormProperties) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.availAttrList = Immutable.List<Kontext.AttrItem>(props.attrList);
        this.availStructAttrList = Immutable.List<Kontext.AttrItem>(props.structAttrList);
        this.attr1 = props.attr1;
        this.attr2 = props.attr2;
        this.d1Labels = Immutable.List<string>();
        this.d2Labels = Immutable.List<string>();

        dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'FREQ_CT_FORM_SET_DIMENSION_ATTR':
                    this.setDimensionAttr(payload.props['dimension'], payload.props['value']);
                    this.notifyChangeListeners();
                break;
                case 'FREQ_CT_SUBMIT':
                    this.submitForm();
                    // leaves page here
                break;
            }
        });
    }

    private getSubmitArgs():MultiDict {
        const args = this.pageModel.getConcArgs();
        args.set('fcrit', `${this.attr1} 0 ${this.attr2} 0`);
        args.set('attr1', this.attr1);
        args.set('attr2', this.attr2);
        return args;
    }


    submitForm():void {
        const args = this.getSubmitArgs();
        window.location.href = this.pageModel.createActionUrl('freqct', args.items());
    }

    importData(data:FreqResultResponse.CTFreqResultData):void {
        const d1Labels:{[name:string]:boolean} = {};
        const d2Labels:{[name:string]:boolean} = {};
        const tableData:Data2DTable = {};
        let fMin = data[0][2];
        let fMax = data[0][2];

        data.forEach(item => {
            d1Labels[item[0]] = true;
            d2Labels[item[1]] = true;

            if (tableData[item[0]] === undefined) {
                tableData[item[0]] = {};
            }
            tableData[item[0]][item[1]] = item[2];

            if (item[2] > fMax) {
                fMax = item[2];
            }
            if (item[2] < fMin) {
                fMin = item[2];
            }
        });

        console.log('min: ', fMin, ', max: ', fMax);


        this.colorStepFn = (v) => ~~Math.floor((v - fMin) * 8 / (fMax - fMin));

        this.d1Labels = Immutable.List<string>(Object.keys(d1Labels).sort());
        this.d2Labels = Immutable.List<string>(Object.keys(d2Labels).sort());
        this.data = tableData;
    }

    getData():any {
        return this.data;
    }

    getD1Labels():Immutable.List<string> {
        return this.d1Labels;
    }

    getD2Labels():Immutable.List<string> {
        return this.d2Labels;
    }

    getColorStepFn():(v:number)=>number {
        return this.colorStepFn;
    }

    /**
     * Return both positional and structural attributes
     * as a single list (positional first).
     */
    getAllAvailAttrs():Immutable.List<Kontext.AttrItem> {
        return this.availAttrList
                .concat(this.availStructAttrList.sort(sortAttrVals)).toList();
    }


    private setDimensionAttr(dimNum:number, v:string):void {
        if (dimNum === 1) {
            this.attr1 = v;

        } else if (dimNum === 2) {
            this.attr2 = v;

        } else {
            throw new Error('Unknown dimension specification');
        }
    }


    getAttr1():string {
        return this.attr1;
    }

    getAttr2():string {
        return this.attr2;
    }
}