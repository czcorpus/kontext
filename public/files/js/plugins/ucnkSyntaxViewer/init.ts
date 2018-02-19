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

/// <reference path="../../types/common.d.ts" />
/// <reference path="../../types/plugins.d.ts" />
/// <reference path="../../vendor.d.ts/rsvp.d.ts" />

import * as RSVP from 'vendor/rsvp';
import {createGenerator} from './ucnkTreeView';
import {SimplePageStore} from '../../stores/base';
import {ActionDispatcher} from '../../app/dispatcher';

declare var require:any;
require('./style.less'); // webpack

/**
 *
 */
class SyntaxTreeViewer extends SimplePageStore implements PluginInterfaces.ISyntaxViewer {

    private pluginApi:Kontext.PluginApi;

    private waitingStatus:boolean;

    private data:any; // TODO type

    private target:HTMLElement; // the value changes on each render() call

    private resizeThrottleTimer:number;

    constructor(dispatcher:ActionDispatcher, pluginApi:Kontext.PluginApi) {
        super(dispatcher);
        this.pluginApi = pluginApi;
        this.waitingStatus = false;
    }

    private renderTree():void {
        const treexFrame = window.document.createElement('div');
        treexFrame.style.width = '90%';
        this.target.appendChild(treexFrame);

        createGenerator(this.pluginApi.getComponentHelpers()).call(
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
                kwic_id: tokenNumber,
                kwic_len: kwicLength
            }

        ).then(
            (data:any) => {
                this.data = data;
                window.addEventListener('resize', this.onPageResize);
                this.renderTree();
                this.waitingStatus = false;
                this.notifyChangeListeners();
            }
        ).catch(
            (error) => {
                this.waitingStatus = false;
                this.close();
                this.pluginApi.showMessage('error', error);
                this.notifyChangeListeners();
            }
        );
    }
}

export default function create(pluginApi:Kontext.PluginApi):RSVP.Promise<PluginInterfaces.ISyntaxViewer> {
    return new RSVP.Promise<PluginInterfaces.ISyntaxViewer>((resolve:(val:PluginInterfaces.ISyntaxViewer)=>void, reject:(e:any)=>void) => {
        resolve(new SyntaxTreeViewer(pluginApi.dispatcher(), pluginApi));
    });
}