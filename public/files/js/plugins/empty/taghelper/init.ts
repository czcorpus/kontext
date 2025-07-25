/*
 * Copyright (c) 2020 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import * as PluginInterfaces from '../../../types/plugins/index.js';
import { EmptyPlugin } from '../init.js';


export class EmptyTagHelperPlugin extends EmptyPlugin implements PluginInterfaces.TagHelper.IPlugin {

    getWidgetView(
        corpname:string,
        sourceId:string,
        tagsetInfo:Array<PluginInterfaces.TagHelper.TagsetInfo>
    ):null {
        return null;
    }

    isActive():boolean {
        return false;
    }

    getRegistrationId():string {
        return 'empty-taghelper-plugin';
    }
}

const create:PluginInterfaces.TagHelper.Factory = (pluginApi) =>
        new EmptyTagHelperPlugin(pluginApi.dispatcher());

export default create;