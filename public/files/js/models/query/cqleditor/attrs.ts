/*
 * Copyright (c) 2018 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

import { Kontext } from '../../../types/common';
import { List, pipe } from 'cnc-tskit';

/**
 * IAttrHelper defines a general object able to
 * validate and give hints about positional and
 * structural attributes and structures.
 */
export interface IAttrHelper {

    structExists(struct:string):boolean;

    structAttrExists(struct:string, attr:string):boolean;

    attrExists(attr:string):boolean;

    getAttrsOfStruct(struct:string):Array<string>;

    getPosAttrs():Array<string>;

    isTagAttr(attr:string):boolean;
}


/**
 * AttrHelper is the default implementation of IAttrHelper
 * used in "rich" CQL editor.
 */
export class AttrHelper implements IAttrHelper {

    private readonly attrList:Array<Kontext.AttrItem>;

    private readonly structAttrList:Array<Kontext.AttrItem>;

    private readonly structList:Array<string>;

    private readonly tagAttr:string;

    constructor(attrList:Array<Kontext.AttrItem>, structAttrList:Array<Kontext.AttrItem>,
            structList:Array<string>, tagAttr:string) {
        this.attrList = attrList;
        this.structAttrList = structAttrList;
        this.structList = structList;
        this.tagAttr = tagAttr;
    }

    structExists(struct:string):boolean {
        return List.some(v => v === struct, this.structList);
    }

    structAttrExists(struct:string, attr:string):boolean {
        return List.some(
            v => `${struct}.${attr}` === v.n,
            this.structAttrList
        );
    }

    attrExists(attr:string):boolean {
        return List.some(
            v => attr === v.n,
            this.attrList
        );
    }

    getAttrsOfStruct(struct:string):Array<string> {
        return pipe(
            this.structAttrList,
            List.filter(v => v.n === struct),
            List.map(v => v.n)
        );
    }

    getPosAttrs():Array<string> {
        return List.map(
            v => v.n,
            this.attrList
        );
    }

    isTagAttr(attr:string):boolean {
        return this.tagAttr === attr;
    }
}

/**
 * NullAttrHelper is used as a 'fake' IAttrHelper implementation
 * in situations where no attribute helper is needed.
 */
export class NullAttrHelper implements IAttrHelper {

    structExists(v:string):boolean {
        return true;
    }

    structAttrExists(struct:string, attr:string):boolean {
        return true;
    }

    attrExists(attr:string):boolean {
        return true;
    }

    getAttrsOfStruct(struct:string):Array<string> {
        return Array<string>();
    }

    getPosAttrs():Array<string> {
        return Array<string>();
    }

    isTagAttr(attr:string):boolean {
        return false;
    }
}
