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

import { empty as rxEmpty } from 'rxjs';
import {PluginInterfaces, IPluginApi} from '../../types/plugins';
import {StatefulModel} from '../../models/base';

declare var require:any;
const $ = require('jquery');
import './js-treex-view';
import { IFullActionControl } from 'kombo';
import { concatMap } from 'rxjs/operators';
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

    private errorHandler:(e:Error)=>void;

    constructor(dispatcher:IFullActionControl, pluginApi:IPluginApi) {
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
        this.emitChange();

        this.pluginApi.ajax$(
            'GET',
            this.pluginApi.createActionUrl('get_syntax_data'),
            {
                corpname: this.pluginApi.getCorpusIdent().id,
                kwic_id: tokenNumber, // this must be run after finalize
                kwic_len: kwicLength
            }

        ).pipe(
            concatMap(
                (data) => {
                    this.data = data;
                    return rxEmpty();
                }
            )
        ).subscribe(
            null,
            (error) => {
                this.close();
                this.pluginApi.showMessage('error', error);
                if (this.errorHandler) {
                    this.errorHandler(error);
                }
            },
            () => {
                this.renderTree();
                window.addEventListener('resize', this.onPageResize);
            }
        );
    }

    registerOnError(fn:(e:Error)=>void):void {
        this.errorHandler = fn;
    }

    private renderTree():void {
        while (this.target.firstChild) {
            this.target.removeChild(this.target.firstChild);
        }
        const treexFrame = window.document.createElement('div');
        treexFrame.style['width'] = `${(window.innerWidth - 55).toFixed(0)}px`;
        treexFrame.style['height'] = `${(window.innerHeight - 70).toFixed(0)}px`;
        treexFrame.style['overflow'] = 'auto';

        $(this.target).append(treexFrame);
        $(treexFrame).treexView(this.data);
    }

}

const create:PluginInterfaces.SyntaxViewer.Factory = (pluginApi) => {
    return new SyntaxTreeViewer(pluginApi.dispatcher(), pluginApi);
};

export default create;