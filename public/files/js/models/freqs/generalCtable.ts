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

import {TextTypes} from '../../types/common';
import {FreqResultResponse} from '../../types/ajaxResponses';
import * as Immutable from 'immutable';
import {StatefulModel} from '../base';
import {PageModel} from '../../app/main';
import {availConfLevels} from './confIntervalCalc';
import {isStructAttr, CTFormProperties, validateMinAbsFreqAttr,
    FreqFilterQuantities} from './ctFreqForm';
import { IFullActionControl } from 'kombo';

/**
 * This type represents a single data item containing
 * required frequency information (abs freq, ipm,
 * confidence intervals).
 */
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

/**
 * Supported frequency quantities
 */
export const enum FreqQuantities {
    ABS = "abs",
    IPM = "ipm"
}

/**
 * This is a common ancestor for both 2d and flat frequency tables.
 */
export abstract class GeneralFreq2DModel extends StatefulModel {

    protected pageModel:PageModel;

    protected attr1:string;

    protected attr2:string;

    /**
     * Note: either absolute freq. or ipm - depends on minFreqType
     */
    protected minFreq:string;

    protected minFreqType:FreqFilterQuantities;

    /**
     * Already encoded criterion for the 1st attribute
     * (it cannot be changed within this model).
     */
    protected ctFcrit1:string;

    /**
     * Already encoded criterion for the 2nd attribute
     * (it cannot be changed within this model).
     */
    protected ctFcrit2:string;

    /**
     * A significance level. We use it rather as an ID here,
     * that's why it's a string.
     */
    protected alphaLevel:string;

    /**
     * Available significance levels. It actually contains
     * pairs of [significance level ID, confidence level ID string]
     */
    private availAlphaLevels:Immutable.List<[string, string]>;

    /**
     * A total number of possible items (meaning: all the combinations of attr1_val vs. attr2_val).
     * This is calculated on server because some data are already filtered there so the client
     * sees only a fraction.
     */
    protected fullSize:number;

    private static CONF_INTERVAL_LEFT_MIN_WARN = 0.0;

    private adhocSubcDetector:TextTypes.IAdHocSubcorpusDetector;

    constructor(dispatcher:IFullActionControl, pageModel:PageModel, props:CTFormProperties,
            adhocSubcDetector:TextTypes.IAdHocSubcorpusDetector) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.ctFcrit1 = props.ctfcrit1;
        this.ctFcrit2 = props.ctfcrit2;
        this.attr1 = props.ctattr1;
        this.attr2 = props.ctattr2;
        this.minFreq = props.ctminfreq;
        this.minFreqType = props.ctminfreq_type;
        this.adhocSubcDetector = adhocSubcDetector;
        this.alphaLevel = '0.05';
        this.availAlphaLevels = this.importAvailAlphaLevels();
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
                    return v && sortMap.get(v.origOrder) / this.fullSize + emptyItemsRatio >= minFreq / 100;
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
            const begin1 = this.ctFcrit1;
            const end1 = this.ctFcrit1;
            const icase2 = ''; // TODO - optionally (?i)
            const begin2 = this.ctFcrit2;
            const end2 = this.ctFcrit2;
            args.set('q2', `p${begin1} ${end1} 0 [${this.attr1}="${icase1}${v1}" & ${this.attr2}="${icase2}${v2}"]`);

        } else if (this.isStructAttr(this.attr1) && !this.isStructAttr(this.attr2)) {
            const [s1, a1] = this.attr1.split('.');
            const icase2 = ''; // TODO - optionally (?i)
            const begin2 = this.ctFcrit2;
            const end2 = this.ctFcrit2;
            args.set('q2', `p${begin2} ${end2} 0 [${this.attr2}="${icase2}${v2}"] within <${s1} ${a1}="${v1}" />`);

        } else {
            const icase1 = ''; // TODO - optionally (?i)
            const begin1 = this.ctFcrit1;
            const end1 = this.ctFcrit1;
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
        return validateMinAbsFreqAttr(v);
    }

    /**
     *
     * @param v
     */
    protected isStructAttr(v:string):boolean {
        return isStructAttr(v);
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

    getMinFreq():string {
        return this.minFreq;
    }

    getMinFreqType():FreqFilterQuantities {
        return this.minFreqType;
    }

    getAvailAlphaLevels():Immutable.List<[string, string]> {
        return this.availAlphaLevels;
    }

    getAlphaLevel():string {
        return this.alphaLevel;
    }

    getConfIntervalLeftMinWarn():number {
        return GeneralFreq2DModel.CONF_INTERVAL_LEFT_MIN_WARN;
    }

    getUsesAdHocSubcorpus():boolean {
        return this.adhocSubcDetector.usesAdHocSubcorpus();
    }

    getConcSelectedTextTypes():{[attr:string]:Array<string>} {
        return this.adhocSubcDetector.exportSelections(false);
    }
}