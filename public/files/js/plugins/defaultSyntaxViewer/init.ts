/*
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

/// <reference path="./js-treex-view.d.ts" />

import { empty as rxEmpty } from 'rxjs';
import { StatefulModel, IModel } from 'kombo';

import { PluginInterfaces, IPluginApi } from '../../types/plugins';


declare var require:any;
const $ = require('jquery');
import './js-treex-view';
import { IFullActionControl } from 'kombo';
import { concatMap } from 'rxjs/operators';
import { HTTP } from 'cnc-tskit';
import { Actions as ConcActions, ActionName as ConcActionName } from '../../models/concordance/actions';
require('./style.css'); // webpack


export interface SyntaxTreeViewerState extends PluginInterfaces.SyntaxViewer.BaseState {
    data:any; // TODO type
}

/**
 *
 */
export class SyntaxTreeViewer extends StatefulModel<SyntaxTreeViewerState> implements PluginInterfaces.SyntaxViewer.IPlugin {

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
        this.changeState(state => {
            state.isBusy = true;
        });

        this.pluginApi.ajax$(
            HTTP.Method.GET,
            this.pluginApi.createActionUrl('get_syntax_data'),
            {
                corpname: this.pluginApi.getCorpusIdent().id,
                kwic_id: state.tokenNumber,
                kwic_len: state.kwicLength
            }

        ).pipe(
            concatMap(
                (data) => {
                    this.changeState(state => {
                        state.data = data;
                    });
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
                const target = document.getElementById(state.targetHTMLElementID);
                this.renderTree(target);
                window.addEventListener('resize', this.onPageResize);
            }
        );
    }

    registerOnError(fn:(e:Error)=>void):void {
        this.errorHandler = fn;
    }

    private renderTree(target:HTMLElement):void {
        while (target.firstChild) {
            target.removeChild(target.firstChild);
        }
        const treexFrame = window.document.createElement('div');
        treexFrame.style['width'] = `${(window.innerWidth - 55).toFixed(0)}px`;
        treexFrame.style['height'] = `${(window.innerHeight - 70).toFixed(0)}px`;
        treexFrame.style['overflow'] = 'auto';

        $(target).append(treexFrame);
        $(treexFrame).treexView(this.state.data);
    }

}

const create:PluginInterfaces.SyntaxViewer.Factory = (pluginApi) => {
    return new SyntaxTreeViewer(pluginApi.dispatcher(), pluginApi);
};

export default create;