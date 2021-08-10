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

import { Observable } from 'rxjs';
import { GeneralProps } from '../kontext';
import { BasePlugin, IPluginApi } from './common';

// ------------------------------------------------------------------------
// ------------------------- [token_connect] plug-in ----------------------

export interface Response {
    token:string;
    items:Array<{
        renderer:string;
        is_kwic_view:boolean;
        contents:Array<[string, string]>;
        found:boolean;
        heading:string;
    }>;
}

export interface RendererData {
    data: Array<[string, string]>;
}

export type Renderer = React.ComponentClass<GeneralProps>|
    React.FC<GeneralProps>;

export interface DataAndRenderer {
    renderer:Renderer;
    contents:GeneralProps; // TODO use unknown and generics
    isKwicView:boolean;
    found:boolean;
    heading:string;
}

export interface TCData {
    token:string;
    renders:Array<DataAndRenderer>;
}

export interface IPlugin extends BasePlugin {

    /**
     * Fetch a detail information about a token with numeric ID equal to tokenId. The
     * token can be multi-word (numTokens > 1). Also an optional additional context
     * can be considered (e.g. when using the plug-in as a source for alternative kwic
     * detail).
     */
    fetchTokenConnect(
        corpusId:string,
        tokenId:number,
        numTokens:number,
        context?:[number, number]
    ):Observable<TCData>;

    selectRenderer(typeId:string):Renderer;

    providesAnyTokenInfo():boolean;
}

export interface Factory {
    (pluginApi:IPluginApi, alignedCorpora:Array<string>):IPlugin;
}

