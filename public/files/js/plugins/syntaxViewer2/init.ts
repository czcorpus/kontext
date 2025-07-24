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

import { IFullActionControl, IModel } from 'kombo';

import * as PluginInterfaces from '../../types/plugins/index.js';
import * as srcData from './srcdata.js';
import { IPluginApi } from '../../types/plugins/common.js';
import * as React from 'react';
import { SyntaxTreeModel } from './model.js';
import { init as initView } from './view.js';
import { PluginName } from '../../app/plugin.js';
import { EmptySyntaxViewer } from '../empty/syntaxViewer/init.js';


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
    if (pluginApi.pluginTypeIsActive(PluginName.SYNTAX_VIEWER)) {
        return new SyntaxTreeViewer(pluginApi.dispatcher(), pluginApi);
    }
    return new EmptySyntaxViewer(
        pluginApi.dispatcher(),
        {
            isBusy: false,
            sentenceTokens: [],
            activeToken: -1,
            targetHTMLElementID: ''
        }
    );
};

export default create;