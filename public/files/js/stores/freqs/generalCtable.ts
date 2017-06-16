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

import * as Immutable from 'vendor/immutable';
import {SimplePageStore} from '../base';
import {PageModel} from '../../tpl/document';
import {confInterval, getAvailConfLevels} from './statTables';


const sortAttrVals = (x1:Kontext.AttrItem, x2:Kontext.AttrItem) => {
    if (x1.label < x2.label) {
        return -1;
    }
    if (x1.label > x2.label) {
        return 1;
    }
    return 0;
};


export interface CTFormInputs {
    ctminfreq:string;
    ctattr1:string;
    ctattr2:string;
    ctfcrit1:string;
    ctfcrit2:string;
}


export interface CTFormProperties extends CTFormInputs {
    attrList:Array<Kontext.AttrItem>;
    structAttrList:Array<Kontext.AttrItem>;
    multiSattrAllowedStructs:Array<string>;
    queryContainsWithin:boolean;
}


export interface CTFreqCell {
    abs:number;
    absConfInterval:[number, number];
    ipm:number;
    ipmConfInterval:[number, number];
    domainSize:number;
    bgColor:string;
    pfilter:[string, string];
}


export abstract class GeneralCTStore extends SimplePageStore {

    public static POSITION_LA = ['-6<0', '-5<0', '-4<0', '-3<0', '-2<0', '-1<0', '0<0', '1<0', '2<0', '3<0', '4<0', '5<0', '6<0'];

    public static POSITION_RA = ['-6>0', '-5>0', '-4>0', '-3>0', '-2>0', '-1>0', '0>0', '1>0', '2>0', '3>0', '4>0', '5>0', '6>0'];

    public static POSITION_LABELS = ['6L', '5L', '4L', '3L', '2L', '1L', 'Node', '1R', '2R', '3R', '4R', '5R', '6R'];

    protected pageModel:PageModel;

    protected attr1:string;

    protected attr2:string;

    protected availAttrList:Immutable.List<Kontext.AttrItem>;

    protected availStructAttrList:Immutable.List<Kontext.AttrItem>;

    protected multiSattrAllowedStructs:Immutable.List<string>;

    protected setupError:string;

    protected queryContainsWithin:boolean;

    protected minAbsFreq:string;

    protected alignType1:string;

    protected ctxIndex1:number;

    protected alignType2:string;

    protected ctxIndex2:number;

    protected alphaLevel:string; // we use it rather as an ID, that's why we use string

    private availAlphaLevels:Immutable.List<[string, string]>;

    private static CONF_INTERVAL_RATIO_WARN = 0.25;

    constructor(dispatcher:Kontext.FluxDispatcher, pageModel:PageModel, props:CTFormProperties) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.availAttrList = Immutable.List<Kontext.AttrItem>(props.attrList);
        this.availStructAttrList = Immutable.List<Kontext.AttrItem>(props.structAttrList);
        this.multiSattrAllowedStructs = Immutable.List<string>(props.multiSattrAllowedStructs);
        this.attr1 = props.ctattr1;
        this.attr2 = props.ctattr2;
        this.minAbsFreq = props.ctminfreq;
        this.alphaLevel = '0.05';
        this.availAlphaLevels = this.importAvailAlphaLevels();
        this.queryContainsWithin = props.queryContainsWithin;
        [this.ctxIndex1, this.alignType1] = this.importCtxValue(props.ctfcrit1);
        [this.ctxIndex2, this.alignType2] = this.importCtxValue(props.ctfcrit2);
    }

    private importAvailAlphaLevels():Immutable.List<[string, string]> {
        return Immutable.List<[string, string]>(
            getAvailConfLevels()
                .sort((x1, x2) => {
                    if (parseFloat(x1) > parseFloat(x2)) {
                        return 1;
                    }
                    if (parseFloat(x1) < parseFloat(x2)) {
                        return -1;
                    }
                    return 0;

                }).map(item => {
                    return <[string, string]>[item, (1 - parseFloat(item)).toFixed(2)];

                })
        );
    }

    private importCtxValue(v:string):[number, string] {
        let srchIdx = GeneralCTStore.POSITION_LA.indexOf(v);
        if (srchIdx > -1) {
            return [srchIdx, 'left'];
        }
        srchIdx = GeneralCTStore.POSITION_RA.indexOf(v);
        if (srchIdx > -1) {
            return [srchIdx, 'right'];
        }
        return  [6, 'left'];
    }

    protected applyQuickFilter(arg1:string, arg2:string):void {
        const args = this.pageModel.getConcArgs();
        args.set('q2', arg1);
        args.set('format', 'json');
        this.pageModel.ajax<Kontext.AjaxResponse>(
            'GET',
            this.pageModel.createActionUrl('quick_filter'),
            args

        ).then(
            (data) => {
                if (!data.contains_errors) {
                    this.pageModel.replaceConcArg('q', data['Q']);
                    const args = this.pageModel.getConcArgs();
                    args.set('q2', arg2);
                    window.location.href = this.pageModel.createActionUrl('quick_filter', args.items());

                } else {
                    this.pageModel.showMessage('error', data.messages[0]);
                }

            },
            (err) => {
                this.pageModel.showMessage('error', err);
            }
        );
    }

    /**
     * Return both positional and structural attributes
     * as a single list (positional first).
     */
    getAllAvailAttrs():Immutable.List<Kontext.AttrItem> {
        return this.availAttrList
                .concat([{n: null, label: '--------------------'}])
                .concat(this.availStructAttrList.sort(sortAttrVals)).toList();
    }

    protected validateAttrs():void {
        if (this.isStructAttr(this.attr1) && this.isStructAttr(this.attr2)
            && (this.multiSattrAllowedStructs.indexOf(this.attr1.split('.')[0]) === -1
                || this.multiSattrAllowedStructs.indexOf(this.attr2.split('.')[0]) === -1)) {
            this.setupError =
                this.multiSattrAllowedStructs.size > 0 ?
                    this.pageModel.translate('freq__ct_only_some_sattr_allowed_{allowed_sattrs}',
                                             {allowed_sattrs: this.multiSattrAllowedStructs.join(', ')}) :
                    this.pageModel.translate('freq__ct_two_sattrs_not_allowed');

        } else {
            this.setupError = '';
        }
    }

    protected setDimensionAttr(dimNum:number, v:string):void {
        if (dimNum === 1) {
            this.attr1 = v;

        } else if (dimNum === 2) {
            this.attr2 = v;

        } else {
            throw new Error('Unknown dimension specification');
        }
    }

    /**
     * Return filter range value (e.g. '-3>0') for a provided dimension attribute.
     *
     * @param dim either 1 (rows) or 2 (cols)
     */
    protected getAttrCtx(dim:number):string {
        if (dim === 1) {
            return this.alignType1 === 'left' ?
                GeneralCTStore.POSITION_LA[this.ctxIndex1] : GeneralCTStore.POSITION_RA[this.ctxIndex1];

        } else if (dim === 2) {
            return this.alignType2 === 'left' ?
                GeneralCTStore.POSITION_LA[this.ctxIndex2] : GeneralCTStore.POSITION_RA[this.ctxIndex2];
        }
        throw new Error('Unknown dimension ' + dim);
    }

    protected getAttrOfDim(dim:number):string {
        switch (dim) {
            case 1:
            return this.attr1;
            case 2:
            return this.attr2;
            default:
            throw new Error(`Unknown dimension: ${dim}`);
        }
    }

    /**
     * Generate pfilter query (actually, two queries) for positive concordance filter
     *
     * @param v1
     * @param v2
     */
    protected generatePFilter(v1:string, v2:string):[string, string] {

        const pfilter = (dim:number, v:string):string => {
            const attr = this.getAttrOfDim(dim);
            if (this.isStructAttr(attr)) {
                const [s, a] = attr.split('.');
                return `p0 0 1 [] within <${s} ${a}="${v}" />`;

            } else {
                const icase = ''; // TODO - optionally (?i)
                const begin = this.getAttrCtx(dim);
                const end = this.getAttrCtx(dim);
                return `p${begin} ${end} 0 [${attr}="${icase}${v}"]`;
            }
        };

        return [pfilter(1, v1), pfilter(2, v2)];
    }

    /**
     *
     * @param v
     */
    protected validateMinAbsFreqAttr(v:string):boolean {
        return /^(0?|([1-9][0-9]*))$/.exec(v) !== null;
    }

    /**
     *
     * @param v
     */
    protected isStructAttr(v:string):boolean {
        return v.indexOf('.') > -1;
    }

    getAttr1():string {
        return this.attr1;
    }

    getAttr2():string {
        return this.attr2;
    }

    getAttr1IsStruct():boolean {
        return this.isStructAttr(this.attr1);
    }

    getAttr2IsStruct():boolean {
        return this.isStructAttr(this.attr2);
    }

    getSetupError():string {
        return this.setupError;
    }

    getQueryContainsWithin():boolean {
        return this.queryContainsWithin;
    }

    getMinAbsFreq():string {
        return this.minAbsFreq;
    }

    getAlignType(dim:number):string {
        if (dim === 1) {
            return this.alignType1;

        } else if (dim === 2) {
            return this.alignType2;
        }
        return undefined;
    }

    getCtxIndex(dim:number):number {
        if (dim === 1) {
            return this.ctxIndex1;

        } else if (dim === 2) {
            return this.ctxIndex2;
        }
        return undefined;
    }

    getAvailAlphaLevels():Immutable.List<[string, string]> {
        return this.availAlphaLevels;
    }

    getAlphaLevel():string {
        return this.alphaLevel;
    }

    getConfIntervalWarnRatio():number {
        return GeneralCTStore.CONF_INTERVAL_RATIO_WARN;
    }

}