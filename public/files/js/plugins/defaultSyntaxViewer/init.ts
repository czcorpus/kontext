/*
 * Copyright (c) 2016 Institute of the Czech National Corpus
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

/// <reference path="../../types/common.d.ts" />
/// <reference path="../../types/plugins.d.ts" />
/// <reference path="../../../ts/declarations/rsvp.d.ts" />
/// <reference path="./js-treex-view.d.ts" />

/// <amd-dependency path="./js-treex-view" />
declare var treexView:JQuery;
declare var $:any;

import * as RSVP from 'vendor/rsvp';
import {SimplePageStore} from '../../stores/base';

/**
 *
 */
export class SyntaxTreeViewer extends SimplePageStore implements PluginInterfaces.ISyntaxViewer {

    private pluginApi:Kontext.PluginApi;

    private waitingStatus:boolean;

    private data:any; // TODO type

    private target:HTMLElement;

    private resizeThrottleTimer:number;

    constructor(dispatcher:Kontext.FluxDispatcher, pluginApi:Kontext.PluginApi) {
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
                corpname: this.pluginApi.getConf('corpname'),
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

export default function create(pluginApi:Kontext.PluginApi):RSVP.Promise<SyntaxTreeViewer> {
    return new RSVP.Promise<SyntaxTreeViewer>((resolve:(val:SyntaxTreeViewer)=>void, reject:(e:any)=>void) => {
        resolve(new SyntaxTreeViewer(pluginApi.dispatcher(), pluginApi));
    });
}