/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Department of Linguistics
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

import { StatefulModel, Action, IModel } from 'kombo';
import * as PluginInterfaces from '../../types/plugins/index.js';

/**
 *
 */
export class DummySyntaxViewModel extends StatefulModel<PluginInterfaces.SyntaxViewer.BaseState>
    implements PluginInterfaces.SyntaxViewer.IPlugin {

    render(target:HTMLElement, tokenNumber:number, kwicLength:number):void {}

    close():void {}

    isWaiting():boolean {
        return false;
    }

    onAction(action:Action) {}

    getModel():IModel<PluginInterfaces.SyntaxViewer.BaseState> {
        return this;
    }

    getView() {
        return undefined;
    }
}