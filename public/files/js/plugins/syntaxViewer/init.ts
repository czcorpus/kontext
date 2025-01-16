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
/// <reference path="./external.d.ts" />

import { StatefulModel, IModel } from 'kombo';

import * as PluginInterfaces from '../../types/plugins/index.js';


import $ from 'jquery';
import './js-treex-view';
import { IFullActionControl } from 'kombo';
import { HTTP, List, pipe } from 'cnc-tskit';
import { Actions } from '../syntaxViewer2/actions.js';
import { Actions as ConcActions } from '../../models/concordance/actions.js';
import { IPluginApi } from '../../types/plugins/common.js';
import { SyntaxTreeViewerState } from './common.js';
import { init as viewInit } from './view.js';
import * as React from 'react';
import './style.css'; // webpack


/**
 *
 */
export class SyntaxTreeViewer extends StatefulModel<SyntaxTreeViewerState> implements PluginInterfaces.SyntaxViewer.IPlugin {

    private readonly pluginApi:IPluginApi;

    private resizeThrottleTimer:number;

    private corpusSelectHandler:(e)=>void;

    private view:React.FC;

    constructor(dispatcher:IFullActionControl, pluginApi:IPluginApi) {
        super(
            dispatcher,
            {
                isBusy: false,
                data: null,
                sentenceTokens: [],
                activeToken: -1,
                targetHTMLElementID: null
            }
        );
        this.pluginApi = pluginApi;
        this.view = viewInit(dispatcher, pluginApi.getComponentHelpers(), this);

        this.addActionHandler<typeof ConcActions.ShowSyntaxView>(
            ConcActions.ShowSyntaxView.name,
            action => {
                const sentenceTokens = pipe(
                    action.payload.sentenceTokens,
                    List.filter(
                        stoken => !!pluginApi.getNestedConf<{[key:string]:boolean}>('pluginData', 'syntax_viewer', 'availability')[stoken.corpus]
                    ),
                    List.map(item => ({...item}))
                );
                this.changeState(state => {
                    state.sentenceTokens = sentenceTokens;
                    state.activeToken = 0;
                    state.targetHTMLElementID = action.payload.targetHTMLElementID;
                    state.isBusy = true;
                });
                this.render();
            }
        );

        this.addActionHandler<typeof Actions.SwitchCorpus>(
            Actions.SwitchCorpus.name,
            action => {
                this.changeState(state => {
                    state.activeToken = List.findIndex(
                        v => v.corpus === action.payload.corpusId,
                        state.sentenceTokens
                    );
                });
                this.render();
            }
        );

        this.corpusSelectHandler = (e) => {
            dispatcher.dispatch<typeof Actions.SwitchCorpus>({
                name: Actions.SwitchCorpus.name,
                payload: {
                    corpusId: e.target.value
                }
            });
        };
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

    getView():React.FC|React.ComponentClass {
        return this.view;
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

    render():void {
        this.changeState(state => {
            state.isBusy = true;
        });
        const activeToken = this.state.sentenceTokens[this.state.activeToken];
        this.pluginApi.ajax$(
            HTTP.Method.GET,
            this.pluginApi.createActionUrl('get_syntax_data'),
            {
                corpname: activeToken.corpus,
                kwic_id: activeToken.tokenId,
                kwic_len: activeToken.kwicLength
            }

        ).subscribe({
            next: data => {
                this.changeState(state => {
                state.data = data;
                });
                const target = document.getElementById(this.state.targetHTMLElementID);
                this.renderTree(target);
                window.addEventListener('resize', this.onPageResize);
            },
            error: error => {
                this.changeState(state => {
                    state.isBusy = false;
                });
                this.close();
                this.dispatchSideEffect<typeof ConcActions.CloseSyntaxView>({
                    name: ConcActions.CloseSyntaxView.name
                });
                this.pluginApi.showMessage('error', error);
            }
        });
    }

    private renderTree(target:HTMLElement):void {
        while (target.firstChild) {
            target.removeChild(target.firstChild);
        }

        if (this.state.sentenceTokens.length > 1) {
            const corpusSwitch = window.document.createElement('select');
            corpusSwitch.onchange = this.corpusSelectHandler;
            List.forEach(
                (sentenceToken, i) => {
                    const option = window.document.createElement('option');
                    option.value = sentenceToken.corpus;
                    option.label = sentenceToken.corpus;
                    option.selected = i === this.state.activeToken;
                    corpusSwitch.append(option);
                },
                this.state.sentenceTokens
            );
            $(target).append(corpusSwitch);
            $(target).append(window.document.createElement('hr'));
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