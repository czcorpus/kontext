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

import { IFullActionControl, StatefulModel } from 'kombo';
import { Maths, Dict, tuple, pipe, List } from 'cnc-tskit';

import { TextTypes } from '../../../types/common';
import { FreqResultResponse } from '../../../types/ajaxResponses';
import { PageModel } from '../../../app/page';
import { MultiDict } from '../../../multidict';
import { ConcQuickFilterServerArgs } from '../../concordance/common';
import { FreqFilterQuantities, CTFormProperties, validateMinAbsFreqAttr, isStructAttr } from './common';


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


export function importAvailAlphaLevels():Array<[Maths.AlphaLevel, string]> {
    return pipe(
        Maths.AlphaLevel,
        Dict.values(),
        List.sorted((x1, x2) => parseFloat(x1) - parseFloat(x2)),
        List.map(item => tuple(item, (1 - parseFloat(item)).toFixed(3)))
    );
}

export interface GeneralFreq2DModelState {

    attr1:string;

    attr2:string;

    /**
     * Note: either absolute freq. or ipm - depends on minFreqType
     */
    minFreq:string;

    minFreqType:FreqFilterQuantities;

    /**
     * Already encoded criterion for the 1st attribute
     * (it cannot be changed within this model).
     */
    ctFcrit1:string;

    /**
     * Already encoded criterion for the 2nd attribute
     * (it cannot be changed within this model).
     */
    ctFcrit2:string;

    /**
     * A significance level. We use it rather as an ID here,
     * that's why it's a string.
     */
    alphaLevel:Maths.AlphaLevel;

    /**
     * Available significance levels. It actually contains
     * pairs of [significance level ID, confidence level ID string]
     */
    availAlphaLevels:Array<[Maths.AlphaLevel, string]>;

    /**
     * A total number of possible items (meaning: all the combinations of attr1_val vs. attr2_val).
     * This is calculated on server because some data are already filtered there so the client
     * sees only a fraction.
     */
    fullSize:number;

    usesAdHocSubcorpus:boolean;

    confIntervalLeftMinWarn:number;
}

/**
 * This is a common ancestor for both 2d and flat frequency tables.
 */
export abstract class GeneralFreq2DModel<T extends GeneralFreq2DModelState> extends StatefulModel<T> {

    protected readonly pageModel:PageModel;

    static readonly CONF_INTERVAL_LEFT_MIN_WARN = 0.0;

    constructor(dispatcher:IFullActionControl, pageModel:PageModel, initState:T) {
        super(
            dispatcher,
            initState
        );
        this.pageModel = pageModel;
    }

    static calcIpm(absFreq:number, totalSize:number) {
        return Math.round(absFreq / totalSize * 1e6 * 100) / 100;
    }

    /**
     * Generate a mapping from original items' order generated during
     * import to indices within sorted list of these items according
     * to the current freq. mode (ipm, abs). This is used when filtering
     * values by percentile.
     * Because the original order may be same for some items, it is
     * also necessary to return the actual number of items before
     * the mapping is created (where multiple values per key are lost).
     */
    abstract createPercentileSortMapping(state:GeneralFreq2DModelState):[{[key:string]:number}, number];


    /**
     *
     */
    protected createMinFreqFilterFn(state:GeneralFreq2DModelState):(CTFreqCell)=>boolean {
        const minFreq = parseInt(state.minFreq || '0', 10);
        switch (state.minFreqType) {
            case FreqFilterQuantities.ABS:
                return (v:CTFreqCell) => v && v.abs >= minFreq;
            case FreqFilterQuantities.IPM:
                return (v:CTFreqCell) => v && v.ipm >= minFreq;
            case FreqFilterQuantities.ABS_PERCENTILE:
            case FreqFilterQuantities.IPM_PERCENTILE:
                const [sortMap, origSize] = this.createPercentileSortMapping(state);
                const emptyItemsRatio = 1 - origSize / state.fullSize;
                return (v:CTFreqCell) => {
                    return v && sortMap[v.origOrder] / state.fullSize + emptyItemsRatio >= minFreq / 100;
                }
            default:
                throw new Error('Unknown freq type: ' + state.minFreqType);
        }
    }

    /**
     * Generate pfilter query (actually, two queries) for positive concordance filter
     *
     * @param v1
     * @param v2
     */
    generatePFilter(state:GeneralFreq2DModelState, v1:string, v2:string):string {
        const args = this.pageModel.getConcArgs() as MultiDict<ConcQuickFilterServerArgs>;

        if (isStructAttr(state.attr1) && isStructAttr(state.attr2)) {
            const [s1, a1] = state.attr1.split('.');
            const [s2, a2] = state.attr2.split('.');
            args.set('q2', `p0 0 1 [] within <${s1} ${a1}="${v1}" /> within <${s2} ${a2}="${v2}" />`);

        } else if (!isStructAttr(state.attr1) && !isStructAttr(state.attr2)) {
            const icase1 = ''; // TODO - optionally (?i)
            const begin1 = state.ctFcrit1;
            const end1 = state.ctFcrit1;
            const icase2 = ''; // TODO - optionally (?i)
            args.set('q2', `p${begin1} ${end1} 0 [${state.attr1}="${icase1}${v1}" & ${state.attr2}="${icase2}${v2}"]`);

        } else if (isStructAttr(state.attr1) && !isStructAttr(state.attr2)) {
            const [s1, a1] = state.attr1.split('.');
            const icase2 = ''; // TODO - optionally (?i)
            const begin2 = state.ctFcrit2;
            const end2 = state.ctFcrit2;
            args.set('q2', `p${begin2} ${end2} 0 [${state.attr2}="${icase2}${v2}"] within <${s1} ${a1}="${v1}" />`);

        } else {
            const icase1 = ''; // TODO - optionally (?i)
            const begin1 = state.ctFcrit1;
            const end1 = state.ctFcrit1;
            const [s2, a2] = state.attr2.split('.');
            args.set('q2', `p${begin1} ${end1} 0 [${state.attr1}="${icase1}${v1}"] within <${s2} ${a2}="${v2}" />`);
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

    static canProvideIpm(state:GeneralFreq2DModelState):boolean {
        return !isStructAttr(state.attr1) || !isStructAttr(state.attr2);
    }
}