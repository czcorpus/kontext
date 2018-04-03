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

/// <reference path="./js-treex-view.d.ts" />

/// <amd-dependency path="./js-treex-view" />
/// <amd-dependency path="jquery" />
declare var $:any;

import {Kontext} from '../../types/common';
import {PluginInterfaces, IPluginApi} from '../../types/plugins';
import {StatefulModel} from '../../models/base';
import {ActionDispatcher} from '../../app/dispatcher';

declare var require:any;
require('./style.less'); // webpack

/**
 *
 */
export class SyntaxTreeViewer extends StatefulModel implements PluginInterfaces.SyntaxViewer.IPlugin {

    private pluginApi:IPluginApi;

    private waitingStatus:boolean;

    private data:any; // TODO type

    private target:HTMLElement;

    private resizeThrottleTimer:number;

    constructor(dispatcher:ActionDispatcher, pluginApi:IPluginApi) {
        super(dispatcher);
        this.pluginApi = pluginApi;
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

        this.pluginApi.ajax(
            'GET',
            this.pluginApi.createActionUrl('get_syntax_data'),
            {
                corpname: this.pluginApi.getCorpusIdent().id,
                kwic_id: tokenNumber, // this must be run after finalize
                kwic_len: kwicLength
            }

        ).then(
            (data) => {
                this.data = data;
                this.renderTree();
                window.addEventListener('resize', this.onPageResize);
            },
            (error) => {
                this.close();
                this.pluginApi.showMessage('error', error);
            }
        );
    }

    private renderTree():void {
        while (this.target.firstChild) {
            this.target.removeChild(this.target.firstChild);
        }
        const treexFrame = window.document.createElement('div');
        treexFrame.style['width'] = `${(window.innerWidth - window.innerWidth * 0.05).toFixed(0)}px`;
        $(this.target).append(treexFrame);
        $(treexFrame).treexView(this.data);
    }

}

const create:PluginInterfaces.SyntaxViewer.Factory = (pluginApi) => {
    return new SyntaxTreeViewer(pluginApi.dispatcher(), pluginApi);
};

export default create;