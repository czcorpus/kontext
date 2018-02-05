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

/// <reference path="../vendor.d.ts/immutable.d.ts" />

import * as Immutable from 'vendor/immutable';

/**
 * IAttrHelper defines a general object able to
 * validate and give hints about positional and
 * structural attributes and structures.
 */
export interface IAttrHelper {

    structExists(struct:string):boolean;

    structAttrExists(struct:string, attr:string):boolean;

    attrExists(attr:string):boolean;

    getAttrsOfStruct(struct:string):Immutable.List<string>;

    getPosAttrs():Immutable.List<string>;
}


/**
 * AttrHelper is the default implementation of IAttrHelper
 * used in "rich" CQL editor.
 */
export class AttrHelper implements IAttrHelper {

    private attrList:Immutable.List<{n:string; label:string}>;

    private structAttrList:Immutable.List<{n:string; label:string}>;

    private availStructs:Immutable.Set<string>;

    constructor(attrList:Immutable.List<{n:string; label:string}>, structAttrList:Immutable.List<{n:string; label:string}>) {
        this.attrList = attrList;
        this.structAttrList = structAttrList;
        this.availStructs = Immutable.Set<string>(this.structAttrList.map(v => v.n.split('.')[0]));
    }

    structExists(struct:string):boolean {
        return this.availStructs.contains(struct);
    }

    structAttrExists(struct:string, attr:string):boolean {
        return !!this.structAttrList.find(v => `${struct}.${attr}` === v.n);
    }

    attrExists(attr:string):boolean {
        return !!this.attrList.find(v => attr === v.n);
    }

    getAttrsOfStruct(struct:string):Immutable.List<string> {
        return this.structAttrList.filter(v => v.n === struct).map(v => v.n).toList();
    }

    getPosAttrs():Immutable.List<string> {
        return this.attrList.map(v => v.n).toList();
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

    getAttrsOfStruct(struct:string):Immutable.List<string> {
        return Immutable.List<string>();
    }

    getPosAttrs():Immutable.List<string> {
        return Immutable.List<string>();
    }
}
