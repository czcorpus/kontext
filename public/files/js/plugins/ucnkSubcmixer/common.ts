/*
 * Copyright (c) 2015 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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

import { Kontext } from '../../types/common';

export interface SubcMixerExpression {
    attrName:string;
    attrValue:string;
    ratio:Kontext.FormValue<string>;
    baseRatio:string; // a ratio in the original corpus
    zeroFixed:boolean;
}

export interface CalculationResults {
    attrs:Array<[string, number, boolean]>;
    total:number;
    ids:Array<string>;
    structs:Array<string>;
}

export interface CalculationResponse extends Kontext.AjaxResponse {
    attrs?:Array<[string,number]>;
    total:number;
    ids?:Array<string>;
    structs:Array<string>;
}

export interface TextTypeAttrVal {
    attrName:string;
    attrValue:string;
    isSelected:boolean;
}
