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

import { QueryFormType } from '../../models/query/actions';
import { QueryType } from '../../models/query/query';
import { PluginInterfaces } from '../../types/plugins';
import { KnownRenderers } from './frontends';

interface ProviderInfo<T> {
    ident:string;
    queryTypes:Array<QueryType>;
    heading:string;
    conf:T;
}


export interface BasicProviderInfo extends ProviderInfo<{}> {
    rendererId:KnownRenderers.BASIC;
}


export interface PosAttrPairRelProviderInfo extends ProviderInfo<{
    attr1:string;
    attr2:string;
    corpus?:string;
}> {
    rendererId:KnownRenderers.POS_ATTR_PAIR_REL
}


export interface CncExtendedSublemmaProviderInfo extends ProviderInfo<{
    lemma:string;
    sublemma:string;
    word:string;
    corpus?:string;
}> {
    rendererId:KnownRenderers.CNC_EXTENDED_SUBLEMMA;
}


export type AnyProviderInfo = BasicProviderInfo | PosAttrPairRelProviderInfo | CncExtendedSublemmaProviderInfo;


export function supportsRequest(info:AnyProviderInfo, req:PluginInterfaces.QuerySuggest.SuggestionArgs):boolean {
    switch (info.rendererId) {
        case KnownRenderers.BASIC:
            return true;
        case KnownRenderers.POS_ATTR_PAIR_REL:
            return info.conf.attr1 === req.posAttr || info.conf.attr2 === req.posAttr || !req.posAttr;
        case KnownRenderers.CNC_EXTENDED_SUBLEMMA:
            return info.conf.lemma === req.posAttr || info.conf.sublemma === req.posAttr || !req.posAttr;
        default:
            return false;
    }
}

export function isEnabledFor(
        info:AnyProviderInfo,
        formType:QueryFormType,
        valueSubformat:PluginInterfaces.QuerySuggest.QueryValueSubformat,
        posAttr:string|undefined
):boolean {
    switch (info.rendererId) {
        case KnownRenderers.BASIC:
            return true;
        case KnownRenderers.POS_ATTR_PAIR_REL:
            return (valueSubformat === 'simple' || valueSubformat === 'simple_ic') &&
                info.conf.attr1 === posAttr || info.conf.attr2 === posAttr || !posAttr;
        case KnownRenderers.CNC_EXTENDED_SUBLEMMA:
            return (valueSubformat === 'simple' || valueSubformat === 'simple_ic') &&
                info.conf.lemma === posAttr || info.conf.sublemma === posAttr || !posAttr;
        default:
            return false;
    }
}
