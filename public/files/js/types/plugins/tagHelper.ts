/*
 * Copyright (c) 2018 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import { QueryFormType } from '../../models/query/actions.js';
import { BasePlugin, IPluginApi } from './common.js';


// ------------------------------------------------------------------------
// ------------------------ [taghelper] plug-in ---------------------------

/**
 * TagsetInfo specifies a complete information
 * about tagset - name, type and used positional
 * attributes.
 */
export interface TagsetInfo {

    /**
     * Concrete tagset identifier. The values
     * are KonText-fabricated (pp_tagset, ud,...).
     * On the other hand, the values are not
     * hardcoded into the code as they are used
     * to fetch proper tagset configuration
     * (which is admin-defined).
     */
    ident:string;

    /**
     * 'other' declares that there is a defined
     * tagset for the corpus but not a supported one.
     */
    type:'positional'|'keyval'|'other';

    corpusName:string;

    /**
     * A positional attribute reserved for part of speech info.
     * If null then we assume all the info is stored within featAttr
     * (see below).
     */
    posAttr:string|null;

    /**
     * A positional attribute all the (other) tag information
     * is stored within.
     */
    featAttr:string;

    /**
     * If true then taghelper widget should be enabled
     */
    widgetEnabled:boolean;

    /**
     * A URL leading to a localized description of a respective tagset
     */
    docUrlLocal:string;

    /**
     * A URL leading to an English version of the tagset description
     */
    docUrlEn:string;
}

export interface ViewProps {
    sourceId:string;
    corpname:string;
    formType:QueryFormType;
    onInsert:()=>void;
    onEscKey:()=>void;
}

export type View = React.ComponentClass<ViewProps>|React.FC<ViewProps>;

export interface IPlugin extends BasePlugin {
    getWidgetView(
        corpname:string,
        sourceId:string,
        tagsetInfo:Array<TagsetInfo>
    ):View;
}

export interface Factory {
    (pluginApi:IPluginApi):IPlugin;
}
