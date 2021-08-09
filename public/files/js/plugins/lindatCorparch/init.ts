/*
 * Copyright (c) 2016 Charles University, Faculty of Mathematics and Physics,
 *                    Institute of Formal and Applied Linguistics
 * Copyright (c) 2016 Charles University, Faculty of Arts,
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

import * as React from 'react';
import * as Kontext from '../../types/kontext';
import * as PluginInterfaces from '../../types/plugins';
import { IPluginApi } from '../../types/plugins/common';
import { TreeWidgetModel } from './model';
import { Views as CorplistViews, init as corplistViewInit } from './view';
import { init as widgetViewInit } from './widget';


export class CorplistPage implements PluginInterfaces.Corparch.ICorplistPage  {

    private pluginApi:IPluginApi;

    private treeModel:TreeWidgetModel;

    private components:CorplistViews;

    constructor(pluginApi:IPluginApi) {
        this.pluginApi = pluginApi;
        this.treeModel = new TreeWidgetModel(
            pluginApi,
            this.pluginApi.getConf<Kontext.FullCorpusIdent>('corpusIdent'),
            (corpusIdent:string) => {
                window.location.href = pluginApi.createActionUrl('query', [['corpname', corpusIdent]]);
            }
        );
        this.components = corplistViewInit(
            pluginApi.dispatcher(),
            pluginApi.getComponentHelpers(),
            this.treeModel
        );
    }

    getForm():React.SFC<{}> {
        return this.components.FilterForm;
    }

    getList():React.ComponentClass {
        const noscElm = document.querySelector('noscript');
        noscElm.insertAdjacentHTML('beforebegin', '<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css" integrity="sha384-BVYiiSIFeK1dGmJRAkycuHAHRg32OmUcww7on3RYdg4Va+PmSTsz/K68vbdEjh4u" crossorigin="anonymous">');
        const content = document.getElementById('content');
        content.className += ' lindatCorparch-content';
        const corplistElms = document.querySelectorAll('.corplist');
        for (let i = 0; i < corplistElms.length; i += 1) {
            corplistElms[i].className += ' lindatCorparch-section';
        }
        return this.components.CorptreePageComponent;
    }
}


export class Plugin {

    protected pluginApi:IPluginApi;

    private treeModel:TreeWidgetModel;

    constructor(pluginApi:IPluginApi) {
        this.pluginApi = pluginApi;
    }

    isActive():boolean {
        return true;
    }

    createWidget(targetAction:string, options:Kontext.GeneralProps):React.ComponentClass<{}> {

        this.treeModel = new TreeWidgetModel(
            this.pluginApi,
            this.pluginApi.getConf<Kontext.FullCorpusIdent>('corpusIdent'),
            (corpusIdent: string) => {
                window.location.href = this.pluginApi.createActionUrl(targetAction, [['corpname', corpusIdent]]);
            }
        );
        const viewsLib = widgetViewInit(
                this.pluginApi.dispatcher(),
                this.pluginApi.getComponentHelpers(),
                this.treeModel
        );
        return viewsLib.CorptreeWidget;
    }

    unregister():void {
        this.treeModel.unregister();
    }

    getRegistrationId():string {
        return this.treeModel.getRegistrationId();
    }

    initCorplistPageComponents():PluginInterfaces.Corparch.ICorplistPage {
        return new CorplistPage(this.pluginApi);;
    }
}


const create:PluginInterfaces.Corparch.Factory = (pluginApi) => {
    return new Plugin(pluginApi);


}

export default create;