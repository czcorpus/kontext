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

import * as PluginInterfaces from '../../../types/plugins';
import { IModel, StatefulModel, IFullActionControl } from 'kombo';


export class EmptySyntaxViewerModel extends StatefulModel<PluginInterfaces.SyntaxViewer.BaseState> {
}


export class EmptySyntaxViewer implements PluginInterfaces.SyntaxViewer.IPlugin {

    private readonly model:EmptySyntaxViewerModel;

    constructor(dispatcher:IFullActionControl, state:PluginInterfaces.SyntaxViewer.BaseState) {
        this.model = new EmptySyntaxViewerModel(dispatcher, state);
    }

    isActive():boolean {
        return false;
    }

    close():void {}

    onPageResize():void {}

    registerOnError(fn:(e:Error)=>void):void {}

    getModel():IModel<PluginInterfaces.SyntaxViewer.BaseState> {
        return this.model;
    }
}

const create:PluginInterfaces.SyntaxViewer.Factory = (pluginApi) => {
    return new EmptySyntaxViewer(
        pluginApi.dispatcher(),
        {
            isBusy: false,
            tokenNumber: -1,
            kwicLength: 0,
            targetHTMLElementID: '',
            corpnames: null,
            selected: null
        }
    );
};

export default create;
