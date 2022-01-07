/*
 * Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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

import { Action } from 'kombo';
import { Dimensions, FreqFilterQuantities, AlignTypes, FreqQuantities } from '../twoDimension/common';
import { Maths } from 'cnc-tskit';
import { ColorMappings } from '../twoDimension/table2d';


export class Actions {

    static FreqctFormSetDimensionAttr: Action<{
        dimension:Dimensions;
        value:string;
    }> = {
            name: 'FREQ_CT_FORM_SET_DIMENSION_ATTR'
        };

    static FreqctFormSetMinFreqType: Action<{
        value: FreqFilterQuantities;
    }> = {
            name: 'FREQ_CT_FORM_SET_MIN_FREQ_TYPE'
        };

    static FreqctFormSetMinFreq: Action<{
        value:string;
    }> = {
            name: 'FREQ_CT_FORM_SET_MIN_FREQ'
        };

    static FreqctFormSetCtx: Action<{
        dim:Dimensions;
        value:number;
    }> = {
            name: 'FREQ_CT_FORM_SET_CTX'
        };

    static FreqctFormSetAlignType: Action<{
        dim:Dimensions;
        value:AlignTypes;
    }> = {
            name: 'FREQ_CT_FORM_SET_ALIGN_TYPE'
        };

    static FreqctFormSubmit: Action<{
    }> = {
            name: 'FREQ_CT_SUBMIT'
        };

    static FreqctSetAlphaLevel: Action<{
        value:Maths.AlphaLevel;
    }> = {
            name: 'FREQ_CT_SET_ALPHA_LEVEL'
        };

    static FreqctSetMinFreq: Action<{
        value:string;
    }> = {
            name: 'FREQ_CT_SET_MIN_FREQ'
        };

    static FreqctSetEmptyVecVisibility: Action<{
        value:boolean;
    }> = {
            name: 'FREQ_CT_SET_EMPTY_VEC_VISIBILITY'
        };

    static FreqctTransposeTable: Action<{
    }> = {
            name: 'FREQ_CT_TRANSPOSE_TABLE'
        };

    static FreqctSortByDimension: Action<{
        dim:Dimensions;
        attr:string;
    }> = {
            name: 'FREQ_CT_SORT_BY_DIMENSION'
        };

    static FreqctSetDisplayQuantity: Action<{
        value:FreqQuantities;
    }> = {
            name: 'FREQ_CT_SET_DISPLAY_QUANTITY'
        };

    static FreqctSetColorMapping: Action<{
        value:ColorMappings;
    }> = {
            name: 'FREQ_CT_SET_COLOR_MAPPING'
        };

    static FreqctSetHighlightedGroup: Action<{
        value:[number, number];
    }> = {
            name: 'FREQ_CT_SET_HIGHLIGHTED_GROUP'
        };

    static FreqctSortFlatList: Action<{
        value:string;
        reversed:boolean;
    }> = {
            name: 'FREQ_CT_SORT_FLAT_LIST'
        };

    static FreqctHighlight2DCoord: Action<{
        coord:[number, number];
    }> = {
            name: 'FREQ_CT_HIGHLIGHT_2D_COORD'
        };

    static FreqctReset2DCoordHighlight: Action<{
    }> = {
            name: 'FREQ_CT_RESET_2D_COORD_HIGHLIGHT'
        };

    static FreqctApplyQuickFilter: Action<{
        url:string;
    }> = {
            name: 'FREQ_CT_APPLY_QUICK_FILTER'
        };

    static SetCtSaveMode: Action<{
        value:string;
    }> = {
            name: 'FREQ_CT_SET_SAVE_MODE'
        };
}
