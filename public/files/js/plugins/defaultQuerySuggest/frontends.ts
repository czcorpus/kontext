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