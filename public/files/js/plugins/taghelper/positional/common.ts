/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
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

import { List } from 'cnc-tskit';

import * as PluginInterfaces from '../../../types/plugins';
import { TagBuilderBaseState } from '../common';



export type RawTagValues = Array<Array<[string, string]>>;


/**
 * Defines a JSON format used by server
 */
export interface TagDataResponse {
    containsErrors:boolean;
    messages:Array<string>;
    labels:Array<string>;
    tags:RawTagValues;
}

/**
 * Defines a single value available in a specific position
 * (e.g. 2nd position, 1st item = 'masculine inanimate')
 */
export interface PositionValue {
    id:string;
    title:string;
    selected:boolean;
    available:boolean;
}

/**
 * Defines options for a single PoS tag position (e.g.: 2nd position = Gender)
 */
export interface PositionOptions {
    label:string;
    values:Array<PositionValue>;
    isLocked:boolean;
    isActive:boolean;
}


export interface PosTagStatus {

    corpname:string;

    canUndo:boolean;

    /**
     * An encoded representation of a tag selection. From CQL
     * point of view, this is just a string. Typically,
     * this can be used directly as a part of 'generatedQuery'.
     *
     * The value is used when user directly modifies an
     * existing tag within a CQL query. In such case, we
     * inject just the raw value.
     */
    rawPattern:string;

    /**
     * A valid CQL fragment directly applicable
     * within square brackets
     * "[EXPR_1 ... EXPR_K-1 RAW_PATTERN EXPR_K+1 ... EXPR_N]"
     *
     * This value is used when user inserts whole new tag expression.
     */
    generatedQuery:string;

    /**
     * Contains all the values (inner lists) along with selection
     * status through whole user interaction (outer list).
     */
    selHistory:Array<Array<PositionOptions>>;

    positions:Array<PositionOptions>;

    presetPattern:string;

    srchPattern:string;

    tagAttr:string;

    queryRange:[number, number];
}


export function createEmptyPosTagsetStatus(
    tagsetInfo:PluginInterfaces.TagHelper.TagsetInfo,
    corpname:string
):PosTagStatus {
    return {
        corpname: corpname,
        selHistory: [[]],
        positions: [],
        tagAttr: tagsetInfo.featAttr,
        presetPattern: '',
        srchPattern: '.*',
        rawPattern: '.*',
        generatedQuery: `${tagsetInfo.featAttr}=".*"`,
        canUndo: false,
        queryRange: [0, 0]
    }
}


export interface PosTagModelState extends TagBuilderBaseState {

    data:{[sourceId:string]:PosTagStatus};
}


export function cloneSelection(data:Array<PositionOptions>):Array<PositionOptions> {
    return List.map(
        item => ({
            ...item,
            values: List.map(
                value => ({...value}),
                item.values
            )
        }),
        data
    );
}