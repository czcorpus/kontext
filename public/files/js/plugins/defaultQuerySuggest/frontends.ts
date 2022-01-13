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


export enum KnownRenderers {
    BASIC = 'basic',
    ERROR = 'error',
    POS_ATTR_PAIR_REL = 'posAttrPairRel',
    CNC_EXTENDED_SUBLEMMA = 'cncExtendedSublemma',
    UNSUPPORTED = 'unsupported'
}


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
    return isDataAndRenderer(v) && v['rendererId'] === KnownRenderers.BASIC;
}

// -----------------------

export interface PosAttrPairRelFrontend extends
        QuerySuggestion<{
            attrs:[string, string, string];
            data:{[attr1:string]:Array<string>};
            value:string;
        }> {
    isActive:true;
}

export function isPosAttrPairRelFrontend(
    v:QuerySuggestion<unknown>

):v is PosAttrPairRelFrontend {
    return isDataAndRenderer(v) && v['rendererId'] === KnownRenderers.POS_ATTR_PAIR_REL;
}

export function isPosAttrPairRelClickPayload(v:any):v is PosAttrPairRelFrontendClickPayload {
    return v['renderer'] === KnownRenderers.POS_ATTR_PAIR_REL;
}

export interface PosAttrPairRelFrontendClickPayload {
    attr1:string;
    attr1Val:string;
    attr2:string;
    attr2Val:string;
    renderer:KnownRenderers.POS_ATTR_PAIR_REL;
}

export interface PosAttrPairRelFrontendClickHanlder {
    (value:PosAttrPairRelFrontendClickPayload):void;
}

// -----------------------

export interface CncExtendedSublemmaFrontend extends
        QuerySuggestion<{
            attrs:[string, string, string];
            data:{[attr1:string]:{
                found_in:Array<'lemma'|'sublemma'|'word'>;
                sublemmas:Array<string>;
            }};
            value:string;
            value_indirect:boolean;
        }> {
    isActive:true;
}

export function isCncExtendedSublemmaFrontend(
    v:QuerySuggestion<unknown>

):v is CncExtendedSublemmaFrontend {
    return isDataAndRenderer(v) && v['rendererId'] === KnownRenderers.CNC_EXTENDED_SUBLEMMA;
}

export function isCncExtendedSublemmaFrontendClickPayload(v:any):v is CncExtendedSublemmaFrontendClickPayload {
    return v['renderer'] === KnownRenderers.CNC_EXTENDED_SUBLEMMA;
}

export interface CncExtendedSublemmaFrontendClickPayload {
    attr1:string;
    attr1Val:string;
    attr2:string;
    attr2Val:string;
    attr3:string;
    attr3Val: string;
    renderer:KnownRenderers.CNC_EXTENDED_SUBLEMMA;
}

export interface CncExtendedSublemmaFrontendClickHandler {
    (value:CncExtendedSublemmaFrontendClickPayload):void;
}

// -----------------------

export interface ErrorFrontend extends QuerySuggestion<Error> {
    isActive:false;
}

export function isErrorFrontend(
    v:QuerySuggestion<unknown>

):v is ErrorFrontend {
    return isDataAndRenderer(v) && v['rendererId'] === KnownRenderers.ERROR;
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

    } else if (isCncExtendedSublemmaFrontend(data)) {
        return pipe(
            data.contents.data,
            Dict.toEntries(),
            List.filter(
                ([lemma, sublemma]) => sublemma.sublemmas.length === 1 && sublemma.sublemmas[0] !== lemma
            ),
            List.map(
                ([lemma,]) => lemma
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
                ...data.contents,
                data: Dict.size(data.contents.data) > 1 ?
                    data.contents.data :
                    Dict.filter(
                        (v, k) => List.size(v) > 1 || (List.size(v) === 1 && v[0] !== k),
                        data.contents.data
                    ),
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
        const maxAttr1Variants = 5;

        const tmpData = pipe(
            data.contents.data,
            Dict.toEntries(),
            List.sortedBy(([,v]) => List.size(v)),
            List.reversed(),
            List.slice(0, maxAttr1Variants),
            Dict.fromEntries()
        );
        const hasLongLemmaList = Dict.size(tmpData) < Dict.size(data.contents.data);
        const hasLongAttrList = pipe(
            tmpData,
            Dict.toEntries(),
            List.some(([,attrs]) => List.last(attrs) === null)
        );
        const newData = Dict.map(
            attrs2 => List.filter(v => v !== null, attrs2),
            tmpData
        );
        return {
            rendererId: data.rendererId,
            providerId: data.providerId,
            heading: data.heading,
            contents: {
                ...data.contents,
                data: newData
            },
            isShortened: hasLongAttrList || hasLongLemmaList,
            isActive: true
        };
    }
    return data;
}


export function mergeResults<T>(
    data1:QuerySuggestion<T>,
    data2:QuerySuggestion<T>

):QuerySuggestion<unknown> {
    if (data1.providerId !== data2.providerId) {
        throw new Error('cannot merge different provider data');

    } else if (isPosAttrPairRelFrontend(data1) && isPosAttrPairRelFrontend(data2)) {
        return {
            rendererId: data1.rendererId,
            providerId: data1.providerId,
            heading: data1.heading,
            contents: {
                ...data1.contents,
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

    } else if (isCncExtendedSublemmaFrontend(data1) && isCncExtendedSublemmaFrontend(data2)) {
        return {
            rendererId: data1.rendererId,
            providerId: data1.providerId,
            heading: data1.heading,
            contents: {
                ...data1.contents,
                data: pipe(
                    data1.contents.data,
                    Dict.map(
                        (curr, attr1) => data2.contents.data[attr1] &&
                                data2.contents.data[attr1].sublemmas.length > List.size(curr.sublemmas) ?
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
