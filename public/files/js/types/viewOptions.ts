/*
 * Copyright (c) 2015 Charles University in Prague, Faculty of Arts,
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

import { WideCtxArgs } from '../models/concordance/common';
import * as Kontext from './kontext';


export interface AttrDesc {
    n: string;
    label: string;
    selected: boolean;
    locked: boolean;
}

export interface StructDesc {
    label: string;
    n: string;
    selected: boolean;
    locked: boolean;
    selectAllAttrs: boolean;
}

export interface StructAttrDesc {
    n: string;
    selected: boolean;
}

export interface RefDesc {
    label: string;
    n: string;
    selected: boolean;
    locked: boolean;
    selectAllAttrs: boolean;
}

export interface RefAttrDesc {
    n: string;
    label: string;
    selected: boolean;
}

/**
 * Modes of how positional attributes are shown
 */
export enum AttrViewMode {
    VISIBLE_ALL = 'visible-all',
    VISIBLE_KWIC = 'visible-kwic',
    VISIBLE_MULTILINE = 'visible-multiline',
    MOUSEOVER = 'mouseover'
}

export type AvailStructAttrs = {[key:string]:Array<StructAttrDesc>};

export interface PageData {
    AttrList:Array<AttrDesc>;
    FixedAttr:string;
    AttrVmode:AttrViewMode;
    CurrentAttrs:Array<string>;
    AvailStructs:Array<{sel:string; label:string; n:string}>;
    StructAttrs:{[attr:string]:Array<string>};
    CurrStructAttrs:Array<string>;
    AvailRefs:Array<{n:string; sel:string; label:string}>;
    ShowConcToolbar:boolean;
    BaseViewAttr:string;
    QueryHintEnabled:boolean;
}

export interface LoadOptionsResponse extends Kontext.AjaxResponse {
    AttrList: Array<AttrDesc>;
    Availstructs: Array<{sel:string; label:string; n:string}>;
    Availrefs:Array<{n:string; sel:string; label:string}>;
    curr_structattrs:Array<string>;
    fixed_attr:string;
    attr_vmode:AttrViewMode;
    base_viewattr:string;
    use_conc_toolbar:boolean;
    structattrs:{[attr:string]:Array<string>};
    CurrentAttrs:Array<string>;
    qs_enabled:boolean;
}

export interface SaveViewAttrsOptionsResponse extends Kontext.AjaxResponse {
    widectx_globals:WideCtxArgs;
    conc_persistence_op_id:string|null;
    conc_args:Array<[string, string]>;
}
