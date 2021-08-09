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

import { ITextTypesModel } from '../textTypes';
import { BasePlugin, IPluginApi } from './common';

// ------------------------------------------------------------------------
// --------------------------- [subcmixer] plug-in ------------------------

export interface Props {
    isActive:boolean;
}

export interface IPlugin extends BasePlugin {
    getWidgetView():View;
}

export type View = React.ComponentClass<Props>|React.FC<Props>;

export interface Factory {
    (
        pluginApi:IPluginApi,
        textTypesModel:ITextTypesModel<{}>,
        corpusIdAttr:string
    ):IPlugin;
}
