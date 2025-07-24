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

import { Action } from 'kombo';
import { AnyTTSelection } from '../textTypes.js';
import { BasePlugin, IPluginApi } from './common.js';
import * as TextTypes from '../textTypes.js';

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
        ttSelections:Array<AnyTTSelection>,
        corpusIdAttr:string
    ):IPlugin;
}


export class Actions {

    static ShowWidget:Action<{
    }> = {
        name: 'GENERAL_SUBCMIXER_SHOW_WIDGET'
    };

    static ShowWidgetDone:Action<{
        attributes:Array<TextTypes.AnyTTSelection>;
    }> = {
        name: 'GENERAL_SUBCMIXER_SHOW_WIDGET_DONE'
    };

    static HideWidget:Action<{
    }> = {
        name: 'GENERAL_SUBCMIXER_HIDE_WIDGET'
    };

    static TextTypesSubcmixerReady:Action<{
        attributes:Array<TextTypes.AnyTTSelection>;
    }> = {
        name: 'GENERAL_SUBCMIXER_TEXT_TYPES_SUBCMIXER_READY'
    };

    static isTextTypesSubcmixerReady(a:Action):a is typeof Actions.TextTypesSubcmixerReady {
        return a.name === Actions.TextTypesSubcmixerReady.name;
    }
}