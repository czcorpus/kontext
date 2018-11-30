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

import * as Rx from '@reactivex/rxjs';
import {PluginInterfaces, IPluginApi} from '../../types/plugins';
import {createGenerator, SourceData, DetailAttrOrders} from './ucnkTreeView';
import {StatefulModel} from '../../models/base';
import {ActionDispatcher} from '../../app/dispatcher';

declare var require:any;
require('./style.less'); // webpack


interface ServerExportedData {
    syntax_viewer:{
        detail_attr_orders:DetailAttrOrders
    };
}

/**
 *
 */
class SyntaxTreeViewer extends StatefulModel implements PluginInterfaces.SyntaxViewer.IPlugin {

    private pluginApi:IPluginApi;

    private waitingStatus:boolean;

    private data:Array<SourceData.Data>; // TODO type

    private target:HTMLElement; // the value changes on each render() call

    private resizeThrottleTimer:number;

    private errorHandler:(e:Error)=>void;

    constructor(dispatcher:ActionDispatcher, pluginApi:IPluginApi) {
        super(dispatcher);
        this.pluginApi = pluginApi;
        this.waitingStatus = false;
    }

    private renderTree():void {
        const treexFrame = window.document.createElement('div');
        treexFrame.style.width = '90%';
        this.target.appendChild(treexFrame);

        createGenerator(
            this.pluginApi.getComponentHelpers(),
            this.pluginApi.getConf<ServerExportedData>('pluginData').syntax_viewer.detail_attr_orders || {}

        ).call(
            null,
            this.data,
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

    isWaiting():boolean {
        return this.waitingStatus;
    }

    close():void {
        window.removeEventListener('resize', this.onPageResize);
    }

    onPageResize = () => {
        if (this.resizeThrottleTimer) {
            window.clearTimeout(this.resizeThrottleTimer);
        }
        this.resizeThrottleTimer = window.setTimeout(() => {
            while (this.target.firstChild) {
                this.target.removeChild(this.target.firstChild);
            }
            this.renderTree();

        }, 250);
    }

    render(target:HTMLElement, tokenNumber:number, kwicLength:number):void {
        this.target = target;
        this.waitingStatus = true;
        this.notifyChangeListeners();

        this.pluginApi.ajax$(
            'GET',
            this.pluginApi.createActionUrl('get_syntax_data'),
            {
                corpname: this.pluginApi.getCorpusIdent().id,
                kwic_id: tokenNumber,
                kwic_len: kwicLength
            }

        ).concatMap(
            (data:any) => {
                this.data = data;
                return Rx.Observable.empty();
            }
        ).subscribe(
            null,
            (error) => {
                this.waitingStatus = false;
                this.close();
                this.pluginApi.showMessage('error', error);
                this.notifyChangeListeners();
                if (this.errorHandler) {
                    this.errorHandler(error);
                }
            },
            () => {
                window.addEventListener('resize', this.onPageResize);
                this.renderTree();
                this.waitingStatus = false;
                this.notifyChangeListeners();
            }
        );
    }
}

const create:PluginInterfaces.SyntaxViewer.Factory = (pluginApi) => {
    return new SyntaxTreeViewer(pluginApi.dispatcher(), pluginApi);
};

export default create;