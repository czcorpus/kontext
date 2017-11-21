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
/// <reference path="../../vendor.d.ts/immutable.d.ts" />

import * as Immutable from 'vendor/immutable';
import {SimplePageStore} from '../base';
import {PageModel} from '../../pages/document';
import {availConfLevels} from './confIntervalCalc';


export function wilsonConfInterval(v:number, base:number, alphaId:string):[number, number] {
    const z = {
        '0.1': 1.6448536269514722,
        '0.05': 1.959963984540054,
        '0.01': 2.5758293035489004
    }[alphaId];
    const p = v / base;
    const sq = z * Math.sqrt( p * (1 - p) / base + z ** 2 / (4 * base ** 2) );
    const denom = 1 + z ** 2 / base;
    const a = p + z ** 2 / (2 * base);

    return [(a - sq) / denom, (a + sq) / denom];
}



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
    ctminfreq_type:string;
    ctattr1:string;
    ctattr2:string;
    ctfcrit1:string;
    ctfcrit2:string;
}


export interface CTFormProperties extends CTFormInputs {
    attrList:Array<Kontext.AttrItem>;
    structAttrList:Array<Kontext.AttrItem>;
    multiSattrAllowedStructs:Array<string>;
}


export interface CTFreqCell {
    origOrder:number;
    abs:number;
    absConfInterval:[number, number];
    ipm:number;
    ipmConfInterval:[number, number];
    domainSize:number;
    bgColor:string;
    pfilter:string;
}


export const roundFloat = (v:number):number => Math.round(v * 100) / 100;


export const enum FreqQuantities {
    ABS = "abs",
    IPM = "ipm"
}

export const enum FreqFilterQuantities {
    ABS = "abs",
    ABS_PERCENTILE = "pabs",
    IPM = "ipm",
    IPM_PERCENTILE = "pipm"
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

    /**
     * Note: either absolute freq. or ipm - depends on minFreqType
     */
    protected minFreq:string;

    protected minFreqType:string;

    protected alignType1:string;

    protected ctxIndex1:number;

    protected alignType2:string;

    protected ctxIndex2:number;

    protected alphaLevel:string; // we use it rather as an ID, that's why we use string

    private availAlphaLevels:Immutable.List<[string, string]>;

    /**
     * A total number of possible items (meaning: all the combinations of attr1_val vs. attr2_val).
     * This is calculated on server because some data are already filtered there so the client
     * sees only a fraction.
     */
    protected fullSize:number;

    private static CONF_INTERVAL_LEFT_MIN_WARN = 0.0;

    constructor(dispatcher:Kontext.FluxDispatcher, pageModel:PageModel, props:CTFormProperties) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.availAttrList = Immutable.List<Kontext.AttrItem>(props.attrList);
        this.availStructAttrList = Immutable.List<Kontext.AttrItem>(props.structAttrList);
        this.multiSattrAllowedStructs = Immutable.List<string>(props.multiSattrAllowedStructs);
        this.attr1 = props.ctattr1;
        this.attr2 = props.ctattr2;
        this.minFreq = props.ctminfreq;
        this.minFreqType = props.ctminfreq_type;
        this.alphaLevel = '0.05';
        this.availAlphaLevels = this.importAvailAlphaLevels();
        [this.ctxIndex1, this.alignType1] = this.importCtxValue(props.ctfcrit1);
        [this.ctxIndex2, this.alignType2] = this.importCtxValue(props.ctfcrit2);
        this.fullSize = null;
    }

    protected calcIpm(v:FreqResultResponse.CTFreqResultItem) {
        return Math.round(v[2] / v[3] * 1e6 * 100) / 100;
    }

    /**
     * Generate a mapping from original items' order generated during
     * import to indices within sorted list of these items according
     * to the current freq. mode (ipm, abs). This is used when filtering
     * values by percentile.
     */
    abstract createPercentileSortMapping():Immutable.Map<number, number>;

    /**
     *
     */
    protected createMinFreqFilterFn():(CTFreqCell)=>boolean {
        const minFreq = parseInt(this.minFreq || '0', 10);
        switch (this.minFreqType) {
            case FreqFilterQuantities.ABS:
                return (v:CTFreqCell) => v && v.abs >= minFreq;
            case FreqFilterQuantities.IPM:
                return (v:CTFreqCell) => v && v.ipm >= minFreq;
            case FreqFilterQuantities.ABS_PERCENTILE:
            case FreqFilterQuantities.IPM_PERCENTILE:
                const sortMap = this.createPercentileSortMapping();
                const emptyItemsRatio = 1 - sortMap.size / this.fullSize;
                return (v:CTFreqCell) => {
                    return v && sortMap.get(v.origOrder) / this.fullSize + emptyItemsRatio > minFreq / 100;
                }
            default:
                throw new Error('Unknown freq type: ' + this.minFreqType);
        }
    }

    private importAvailAlphaLevels():Immutable.List<[string, string]> {
        return Immutable.List<[string, string]>(
            availConfLevels
                .sort((x1, x2) => parseFloat(x1) - parseFloat(x2))
                .map(item => {
                    return <[string, string]>[item, (1 - parseFloat(item)).toFixed(3)];

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

    getPosAttrs():Immutable.List<Kontext.AttrItem> {
        return this.availAttrList;
    }

    getStructAttrs():Immutable.List<Kontext.AttrItem> {
        return this.availStructAttrList.sort(sortAttrVals).toList();
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
    protected generatePFilter(v1:string, v2:string):string {
        const args = this.pageModel.getConcArgs();

        if (this.isStructAttr(this.attr1) && this.isStructAttr(this.attr2)) {
            const [s1, a1] = this.attr1.split('.');
            const [s2, a2] = this.attr2.split('.');
            args.set('q2', `p0 0 1 [] within <${s1} ${a1}="${v1}" /> within <${s2} ${a2}="${v2}" />`);

        } else if (!this.isStructAttr(this.attr1) && !this.isStructAttr(this.attr2)) {
            const icase1 = ''; // TODO - optionally (?i)
            const begin1 = this.getAttrCtx(1);
            const end1 = this.getAttrCtx(1);
            const icase2 = ''; // TODO - optionally (?i)
            const begin2 = this.getAttrCtx(2);
            const end2 = this.getAttrCtx(2);
            args.set('q2', `p${begin1} ${end1} 0 [${this.attr1}="${icase1}${v1}" & ${this.attr2}="${icase2}${v2}"]`);

        } else if (this.isStructAttr(this.attr1) && !this.isStructAttr(this.attr2)) {
            const [s1, a1] = this.attr1.split('.');
            const icase2 = ''; // TODO - optionally (?i)
            const begin2 = this.getAttrCtx(2);
            const end2 = this.getAttrCtx(2);
            args.set('q2', `p${begin2} ${end2} 0 [${this.attr2}="${icase2}${v2}"] within <${s1} ${a1}="${v1}" />`);

        } else {
            const icase1 = ''; // TODO - optionally (?i)
            const begin1 = this.getAttrCtx(1);
            const end1 = this.getAttrCtx(1);
            const [s2, a2] = this.attr2.split('.');
            args.set('q2', `p${begin1} ${end1} 0 [${this.attr1}="${icase1}${v1}"] within <${s2} ${a2}="${v2}" />`);
        }
        return this.pageModel.createActionUrl('quick_filter', args);
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

    canProvideIpm():boolean {
        return !this.getAttr1IsStruct() || !this.getAttr2IsStruct();
    }

    getSetupError():string {
        return this.setupError;
    }

    getMinFreq():string {
        return this.minFreq;
    }

    getMinFreqType():string {
        return this.minFreqType;
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

    getConfIntervalLeftMinWarn():number {
        return GeneralCTStore.CONF_INTERVAL_LEFT_MIN_WARN;
    }

}