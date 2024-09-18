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

import { IFullActionControl, StatefulModel } from 'kombo';
import { HTTP, List, pipe } from 'cnc-tskit';

import * as PluginInterfaces from '../../types/plugins';
import { DetailAttrOrders } from './common';
import { Actions as ConcActions } from '../../models/concordance/actions';
import { Actions } from './actions';
import * as srcData from './srcdata';
import { IPluginApi } from '../../types/plugins/common';
import { debounceTime, Subject } from 'rxjs';


declare var require:any;
require('./style.css'); // webpack


interface ServerExportedData {
    syntax_viewer:{
        detail_attr_orders:DetailAttrOrders
    };
}

export interface SyntaxTreeModelState extends PluginInterfaces.SyntaxViewer.BaseState {
    data:Array<srcData.Data>;
    detailAttrOrders:DetailAttrOrders;
    windowSize:[number, number];
    expanded:boolean;
}

/**
 *
 */
export class SyntaxTreeModel extends StatefulModel<SyntaxTreeModelState> {

    private readonly pluginApi:IPluginApi;

    private resizeEvents:Subject<[number, number]>;

    private static readonly RESIZE_DEBOUNCE_MS = 600;


    constructor(dispatcher:IFullActionControl, pluginApi:IPluginApi) {
        super(
            dispatcher,
            {
                isBusy: false,
                data: null,
                sentenceTokens: [],
                activeToken: -1,
                targetHTMLElementID: null,
                detailAttrOrders: pluginApi.getConf<ServerExportedData>('pluginData').
                    syntax_viewer.detail_attr_orders || {},
                windowSize: [window.innerWidth, window.innerHeight],
                expanded: false,
            }
        );
        this.pluginApi = pluginApi;
        this.resizeEvents = new Subject();
        this.resizeEvents.
            pipe(
                debounceTime(SyntaxTreeModel.RESIZE_DEBOUNCE_MS)
            ).
            subscribe(
                ([width, height]) => {
                    dispatcher.dispatch(
                        Actions.AreaResized,
                        {width, height}
                    );
                }
            );

        this.addActionHandler(
            Actions.AreaResized,
            action => {
                this.changeState(
                    state => {
                        state.windowSize = [action.payload.width, action.payload.height];
                    }
                );
            }
        );

        this.addActionHandler(
            Actions.ToggleExpanded,
            action => {
                this.changeState(
                    state => {
                        state.expanded = !state.expanded;
                    }
                );
            }
        );

        this.addActionHandler(
            ConcActions.ShowSyntaxView,
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
                this.reloadData();
            }
        );

        this.addActionHandler(
            Actions.SwitchCorpus,
            action => {
                const target = document.getElementById('treex-frame');
                if (target) {
                    target.remove();
                }
                this.changeState(state => {
                    state.activeToken = List.findIndex(
                        v => v.corpus === action.payload.corpusId,
                        state.sentenceTokens
                    );
                    state.isBusy = true;
                });
                this.reloadData();
            }
        );

        this.addActionHandler(
            ConcActions.CloseSyntaxView,
            action => {
                window.removeEventListener('resize', this.onPageResize);
            }
        )
    }

    onPageResize = () => {
        this.resizeEvents.next([window.innerWidth, window.innerHeight])
    }

    reloadData() {
        const activeToken = this.state.sentenceTokens[this.state.activeToken];
        this.pluginApi.ajax$<Array<srcData.Data>>(
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
                    state.isBusy = false;
                });
                window.addEventListener('resize', this.onPageResize);
            },
            error: error => {
                this.changeState(state => {
                    state.isBusy = false;
                });
                this.pluginApi.showMessage('error', error);
            },
        });
    }
}
