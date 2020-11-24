/*
 * Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
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

import { PluginInterfaces } from '../../../types/plugins';
import { of as rxOf, Observable } from 'rxjs';

export class EmptyTokenConnectPlugin implements PluginInterfaces.TokenConnect.IPlugin {

    isActive():boolean {
        return false;
    }

    fetchTokenConnect(
        corpusId:string,
        tokenId:number,
        numTokens:number,
        context?:[number, number]
    ):Observable<PluginInterfaces.TokenConnect.TCData> {

        return rxOf(null);
    }

    selectRenderer(typeId:string):PluginInterfaces.TokenConnect.Renderer {
        return null;
    }

    providesAnyTokenInfo():boolean {
        return false;
    }
}


const create:PluginInterfaces.TokenConnect.Factory = (pluginApi) => {
    return new EmptyTokenConnectPlugin();
};

export default create;