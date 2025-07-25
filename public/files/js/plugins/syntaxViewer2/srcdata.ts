/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import { DetailValue } from './common.js';

/*
 * This module describes a data format generated by KonText
 * in accordance with [js-treex-view](https://github.com/ufal/js-treex-view)
 * library's specification.
 */


export interface Node {
    id:string;
    hint:string;
    labels:Array<string>;
    parent:string;
    firstson:string;
    rbrother:string;
    lbrother:string;
    order:number;
    depth:number;
    data:{[attr:string]:DetailValue};
    multival_flag:'start'|'end'|null;
    hidden?:boolean;
}

export interface Tree {
    layer:string;
    nodes:Array<Node>;
}

export interface Zone {
    trees:{[ident:string]:Tree};
    sentence:string;
}

export type Token = [string, string];

export type Desc = Array<Token>;

/**
 *
 */
export interface Data {
    zones:{[ident:string]:Zone};
    desc:Desc;
    kwicPosition:Array<number>; // position within desc
}
