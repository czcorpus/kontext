/*
 * Copyright (c) 2020 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
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

import { Dict, List, pipe } from 'cnc-tskit';
import { QuerySuggestion } from '../../models/query/query';


export interface BasicFrontend extends QuerySuggestion<Array<string>> {
    isActive:false;
}

function isDataAndRenderer(v:any):boolean {
    return v['rendererId'] !== undefined && v['contents'] !== undefined
        && v['heading'] !== undefined;
}

export function isBasicFrontend(
    v:QuerySuggestion<unknown>

):v is BasicFrontend {
    return isDataAndRenderer(v) && v['rendererId'] === 'basic';
}

// -----------------------

export interface PosAttrPairRelFrontend extends
        QuerySuggestion<{
            attrs:[string, string];
            data:{[attr1:string]:Array<string>};
        }> {
    isActive:true;
}

export function isPosAttrPairRelFrontend(
    v:QuerySuggestion<unknown>

):v is PosAttrPairRelFrontend {
    return isDataAndRenderer(v) && v['rendererId'] === 'posAttrPairRel';
}

export function isPosAttrPairRelClickValue(v:any):v is [string, string, string, string] {
    return Array.isArray(v) && typeof v[0] === 'string' && typeof v[1] === 'string' &&
            (typeof v[2] === 'string') &&
            (typeof v[3] === 'string' || v[3] === undefined) && v.length === 4;
}

// -----------------------

export interface ErrorFrontend extends QuerySuggestion<Error> {
    isActive:false;
}

export function isErrorFrontend(
    v:QuerySuggestion<unknown>

):v is ErrorFrontend {
    return isDataAndRenderer(v) && v['rendererId'] === 'error';
}

// -----------------------

export function listAttrs1ToExtend<T>(data:QuerySuggestion<T>):Array<string> {

    if (isPosAttrPairRelFrontend(data)) {
        return pipe(
            data.contents.data,
            Dict.toEntries(),
            List.filter(
                ([attr1, attrs2]) => attrs2.length === 1 && attrs2[0] !== attr1
            ),
            List.map(
                ([attr1,]) => attr1
            )
        );
    }
    return [];
}

// ----------------------

export function filterOutTrivialSuggestions<T>(data:QuerySuggestion<T>):QuerySuggestion<unknown> {

    if (isPosAttrPairRelFrontend(data)) {
        return {
            ...data,
            contents: {
                attrs: data.contents.attrs,
                data: Dict.filter(
                    (v, k) => List.size(v) > 1 || (List.size(v) === 1 && v[0] !== k),
                    data.contents.data
                )
            }
        };

    } else {
        return data;
    }
}

// ----------------------

export function cutLongResult<T>(
    data:QuerySuggestion<T>
):QuerySuggestion<unknown> {

    if (isPosAttrPairRelFrontend(data)) {
        const newData = pipe(
            data.contents.data,
            Dict.toEntries(),
            List.sortedBy(([,v]) => List.size(v)),
            List.reversed(),
            List.filter((v, i) => i < 3),
            Dict.fromEntries()
        );
        return {
            rendererId: data.rendererId,
            providerId: data.providerId,
            heading: data.heading,
            contents: {
                attrs: data.contents.attrs,
                data: newData
            },
            isShortened: Dict.size(newData) < Dict.size(data.contents.data),
            isActive: true
        };

    }
    return data;
}


export function mergeResults<T>(
    data1:QuerySuggestion<T>,
    data2:QuerySuggestion<T>

):QuerySuggestion<unknown> {
    if (isPosAttrPairRelFrontend(data1) && isPosAttrPairRelFrontend(data2)) {
        if (data1.providerId !== data2.providerId) {
            throw new Error('cannot merge different provider data');
        }
        return {
            rendererId: data1.rendererId,
            providerId: data1.providerId,
            heading: data1.heading,
            contents: {
                attrs: data1.contents.attrs,
                data: pipe(
                    data1.contents.data,
                    Dict.map(
                        (curr, attr1) => data2.contents.data[attr1] &&
                                data2.contents.data[attr1].length > List.size(curr) ?
                            data2.contents.data[attr1] :
                            data1.contents.data[attr1]
                    )
                )
            },
            isShortened: data1.isShortened || data2.isShortened,
            isActive: true
        }

    } else {
        return data2; // TODO
    }
}
