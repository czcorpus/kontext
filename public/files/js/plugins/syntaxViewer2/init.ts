/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
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

import { IFullActionControl, IModel } from 'kombo';

import * as PluginInterfaces from '../../types/plugins';
import * as srcData from './srcdata';
import { IPluginApi } from '../../types/plugins/common';
import * as React from 'react';
import { SyntaxTreeModel } from './model';
import { init as initView } from './view';


declare var require:any;
require('./style.css'); // webpack


export interface SyntaxTreeViewerState extends PluginInterfaces.SyntaxViewer.BaseState {
    data:Array<srcData.Data>;
}

/**
 *
 */
class SyntaxTreeViewer implements PluginInterfaces.SyntaxViewer.IPlugin {

    private readonly pluginApi:IPluginApi;

    private view:React.FC|React.ComponentClass;

    private model:SyntaxTreeModel;


    constructor(dispatcher:IFullActionControl, pluginApi:IPluginApi) {
        this.pluginApi = pluginApi;
        this.model = new SyntaxTreeModel(this.pluginApi.dispatcher(), this.pluginApi);
        this.view = initView(
            this.pluginApi.dispatcher(),
            this.pluginApi.getComponentHelpers(),
            this.model
        );
    }

    isActive():boolean {
        return true;
    }

    getView() {
        return this.view;
    }

    getModel():IModel<PluginInterfaces.SyntaxViewer.BaseState> {
        return this.model;
    }
}

const create:PluginInterfaces.SyntaxViewer.Factory = (pluginApi) => {
    return new SyntaxTreeViewer(pluginApi.dispatcher(), pluginApi);
};

export default create;