/*
 * Copyright (c) 2017 Charles University, Faculty of Arts,
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

import { Kontext, TextTypes } from '../../../types/common';
import { AjaxConcResponse } from '../../concordance/common';

export const sortAttrVals = (x1:Kontext.AttrItem, x2:Kontext.AttrItem) => {
    if (x1.label < x2.label) {
        return -1;
    }
    if (x1.label > x2.label) {
        return 1;
    }
    return 0;
};


/**
 * Provides a unified way how to round internal values. Number
 * are round to 2 decimal places.
 * @param v
 */
export const roundFloat = (v:number):number => Math.round(v * 100) / 100;

/**
 * Test whether a provided identifier represents
 * a structural attribute (e.g. 'doc.id', 'div.author').
 */
export const isStructAttr = (v:string):boolean => {
    return v.indexOf('.') > -1;
};

/**
 * Test for non-negative values.
 */
export const validateMinAbsFreqAttr = (v:string):boolean => {
    return /^(0?|([1-9][0-9]*))$/.exec(v) !== null;
};

/**
 * Test for values 0 < x <= 100
 */
export const validatePercentile = (v:string):boolean => {
    return validateMinAbsFreqAttr(v) && parseFloat(v) > 0 && parseFloat(v) <= 100;
};

/**
 * Test whether a provided quantity represents
 * a percentile-based one.
 */
export const isPercentileFilterQuantity = (v:FreqFilterQuantities):boolean => {
    return v === FreqFilterQuantities.ABS_PERCENTILE || v === FreqFilterQuantities.IPM_PERCENTILE;
};

/**
 * Input values for 2d frequency entry form.
 */
export interface CTFormInputs {
    ctminfreq:string;
    ctminfreq_type:FreqFilterQuantities;
    ctattr1:string;
    ctattr2:string;
    ctfcrit1:string;
    ctfcrit2:string;
}

/**
 * All the inputs and required data for 2d freq.
 * entry form.
 */
export interface CTFormProperties extends CTFormInputs {
    attrList:Array<Kontext.AttrItem>;
    structAttrList:Array<Kontext.AttrItem>;
    usesAdHocSubcorpus:boolean;
    selectedTextTypes:TextTypes.ExportedSelection;
}

export const enum FreqQuantities {
    ABS = 'abs',
    IPM = 'ipm'
}

/**
 * Supported filtering quantities.
 */
export const enum FreqFilterQuantities {
    ABS = 'abs',
    ABS_PERCENTILE = 'pabs',
    IPM = 'ipm',
    IPM_PERCENTILE = 'pipm'
}

export const enum AlignTypes {
    RIGHT = 'right',
    LEFT = 'left'
}

export const enum Dimensions {
    FIRST = 1,
    SECOND = 2
}



export type CTFreqResultItem = [string, string, number, number];

export interface CTFreqResultData {
    data: Array<CTFreqResultItem>;
    full_size:number;
}

export interface CTFreqResultResponse extends AjaxConcResponse {
    data:CTFreqResultData;
    attr1:string;
    attr2:string;
    ctfreq_form_args:{
        ctattr1:string;
        ctattr2:string;
        ctfcrit1:string;
        ctfcrit2:string;
        ctminfreq:string
    };
}

export interface CTFreqResultDummyResponse {
    data:CTFreqResultData;
    isDummy:true;
}

export function isDummyResponse(v:CTFreqResultResponse|CTFreqResultDummyResponse):v is CTFreqResultDummyResponse {
    return v['isDummy'] === true;
}