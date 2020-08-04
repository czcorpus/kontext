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

import { IFullActionControl, StatefulModel, IModel } from 'kombo';
import { HTTP } from 'cnc-tskit';

import { PluginInterfaces, IPluginApi } from '../../types/plugins';
import { createGenerator, SourceData, DetailAttrOrders } from './ucnkTreeView';
import { Actions as ConcActions, ActionName as ConcActionName } from '../../models/concordance/actions';


declare var require:any;
require('./style.less'); // webpack


interface ServerExportedData {
    syntax_viewer:{
        detail_attr_orders:DetailAttrOrders
    };
}

export interface SyntaxTreeViewerState extends PluginInterfaces.SyntaxViewer.BaseState {
    data:Array<SourceData.Data>;
}

/**
 *
 */
class SyntaxTreeViewer extends StatefulModel<SyntaxTreeViewerState> implements PluginInterfaces.SyntaxViewer.IPlugin {

    private readonly pluginApi:IPluginApi;

    private resizeThrottleTimer:number;

    private errorHandler:(e:Error)=>void;

    constructor(dispatcher:IFullActionControl, pluginApi:IPluginApi) {
        super(
            dispatcher,
            {
                isBusy: false,
                data: null,
                kwicLength: 0,
                tokenNumber: -1,
                targetHTMLElementID: null
            }
        );
        this.pluginApi = pluginApi;

        this.addActionHandler<ConcActions.ShowSyntaxView>(
            ConcActionName.ShowSyntaxView,
            action => {
                this.changeState(state => {
                    state.tokenNumber = action.payload.tokenNumber;
                    state.kwicLength = action.payload.kwicLength;
                    state.targetHTMLElementID = action.payload.targetHTMLElementID;
                    state.isBusy = true;
                });
                this.render(this.state);
            }
        );
    }

    isActive():boolean {
        return true;
    }

    private renderTree(target:HTMLElement):void {
        const treexFrame = window.document.createElement('div');
        treexFrame.style.width = '90%';
        target.appendChild(treexFrame);

        createGenerator(
            this.pluginApi.getComponentHelpers(),
            this.pluginApi.getConf<ServerExportedData>('pluginData').syntax_viewer.detail_attr_orders || {}

        ).call(
            null,
            this.state.data,
            'cs',
            'default',
            treexFrame,
            {
                width: null, // = auto
                height: null, // = auto
                paddingTop: 20,
                paddingBottom: 50,
                paddingLeft: 20,
                paddingRight: 20,
                onOverflow: (width:number, height:number) => {
                    const mo = document.getElementById('modal-overlay');
                    const box = <HTMLElement>mo.querySelector('div.syntax-tree');
                    box.style['top'] = '0';
                    box.style['left'] = '50%';
                    box.style['transform'] = 'translate(-50%, 0%)';
                    return [width, height];
                }
            }
        );
    }

    registerOnError(fn:(e:Error)=>void):void {
        this.errorHandler = fn;
    }

    close():void {
        window.removeEventListener('resize', this.onPageResize);
    }

    getModel():IModel<PluginInterfaces.SyntaxViewer.BaseState> {
        return this;
    }

    onPageResize = () => {
        const target = document.getElementById(this.state.targetHTMLElementID);
        if (this.resizeThrottleTimer) {
            window.clearTimeout(this.resizeThrottleTimer);
        }
        this.resizeThrottleTimer = window.setTimeout(() => {
            while (target.firstChild) {
                target.removeChild(target.firstChild);
            }
            this.renderTree(target);

        }, 250);
    }

    render(state:SyntaxTreeViewerState):void {

        this.pluginApi.ajax$(
            HTTP.Method.GET,
            this.pluginApi.createActionUrl('get_syntax_data'),
            {
                corpname: this.pluginApi.getCorpusIdent().id,
                kwic_id: state.tokenNumber,
                kwic_len: state.kwicLength
            }

        ).subscribe(
            (data:any) => {
                this.changeState(state => {
                    state.data = data;
                    state.isBusy = false;
                });
            },
            (error) => {
                this.changeState(state => {
                    state.isBusy = false;
                });
                this.close();
                this.pluginApi.showMessage('error', error);
                if (this.errorHandler) {
                    this.errorHandler(error);
                }
            },
            () => {
                window.addEventListener('resize', this.onPageResize);
                const target = document.getElementById(state.targetHTMLElementID);
                this.renderTree(target);
                this.changeState(state => {
                    state.isBusy = false;
                });
            }
        );
    }
}

const create:PluginInterfaces.SyntaxViewer.Factory = (pluginApi) => {
    return new SyntaxTreeViewer(pluginApi.dispatcher(), pluginApi);
};

export default create;