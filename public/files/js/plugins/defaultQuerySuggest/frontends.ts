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

import { PluginInterfaces } from '../../types/plugins';
import { Dict, List, pipe } from 'cnc-tskit';


export interface BasicFrontend extends
    PluginInterfaces.QuerySuggest.DataAndRenderer<Array<string>> {
}

function isDataAndRenderer(v:any):boolean {
    return v['rendererId'] !== undefined && v['contents'] !== undefined
        && v['heading'] !== undefined;
}

export function isBasicFrontend(
    v:PluginInterfaces.QuerySuggest.DataAndRenderer<unknown>

):v is BasicFrontend {
    return isDataAndRenderer(v) && v['rendererId'] === 'basic';
}

// -----------------------

export interface PosAttrPairRelFrontend extends
        PluginInterfaces.QuerySuggest.DataAndRenderer<{
            attrs:[string, string];
            data:{[attr1:string]:Array<string>};
        }> {
}

export function isPosAttrPairRelFrontend(
    v:PluginInterfaces.QuerySuggest.DataAndRenderer<unknown>

):v is PosAttrPairRelFrontend {
    return isDataAndRenderer(v) && v['rendererId'] === 'posAttrPairRel';
}

// -----------------------

export interface ErrorFrontend extends
        PluginInterfaces.QuerySuggest.DataAndRenderer<Error> {
}

export function isErrorFrontend(
    v:PluginInterfaces.QuerySuggest.DataAndRenderer<unknown>

):v is ErrorFrontend {
    return isDataAndRenderer(v) && v['rendererId'] === 'error';
}

// -----------------------

export function listAttrs1ToExtend<T>(data:PluginInterfaces.QuerySuggest.DataAndRenderer<T>):Array<string> {

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


export function mergeResults<T>(
    data1:PluginInterfaces.QuerySuggest.DataAndRenderer<T>,
    data2:PluginInterfaces.QuerySuggest.DataAndRenderer<T>

):PluginInterfaces.QuerySuggest.DataAndRenderer<unknown> {
    if (isPosAttrPairRelFrontend(data1) && isPosAttrPairRelFrontend(data2)) {
        return {
            rendererId: data1.rendererId,
            heading: data1.heading,
            contents: {
                attrs: data1.contents.attrs,
                data: pipe(
                    data1.contents.data,
                    Dict.map(
                        (_, attr1) => data2.contents.data[attr1] ?
                            data2.contents.data[attr1] :
                            data1.contents.data[attr1]
                    )
                )
            }
        }

    } else {
        return data2; // TODO
    }

}