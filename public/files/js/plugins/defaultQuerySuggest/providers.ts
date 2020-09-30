/*
 * Copyright (c) 2020 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
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
import { QueryType } from '../../models/query/common';

interface ProviderInfo<T> {
    ident:string;
    queryTypes:Array<QueryType>;
    heading:string;
    onItemClick:PluginInterfaces.QuerySuggest.ItemClickAction;
    conf:T;
}

export interface BasicProviderInfo extends ProviderInfo<{}> {
    rendererId:'basic';
}

export interface PosAttrPairRelProviderInfo extends ProviderInfo<{
    attr1:string;
    attr2:string;
    corpus?:string
}> {
    rendererId:'posAttrPairRel';
}

export type AnyProviderInfo = BasicProviderInfo | PosAttrPairRelProviderInfo;

export function supportsRequest(info:AnyProviderInfo, req:PluginInterfaces.QuerySuggest.SuggestionArgs):boolean {
    switch (info.rendererId) {
        case 'basic':
            return true;
        case 'posAttrPairRel':
            return info.conf.attr1 === req.posAttr || info.conf.attr2 === req.posAttr;
        default:
            return false;
    }

}