/*
 * Copyright (c) 2023 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
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

import * as PluginInterfaces from '../../types/plugins';
import { StatefulModel, IFullActionControl } from 'kombo';
import { IPluginApi } from '../../types/plugins/common';
import { Dict, HTTP, List } from 'cnc-tskit';
import { AjaxResponse } from '../../types/kontext';
import { AttrSet } from '../../types/plugins/tokensLinking';
import { Actions as ConcActions } from '../../models/concordance/actions';


export interface TokensLinkingState {
    corpora:Array<string>;
    isBusy:boolean;
}


export interface TokensLinkingModelArgs {
    dispatcher:IFullActionControl;
    pluginApi:IPluginApi;
    corpora:Array<string>;
}

export interface FetchDataResponse extends AjaxResponse {
    data:{
        [provider:string]:Array<{
            attrs:AttrSet;
            tokenId:number;
            link:Array<{
                corpname:string;
                tokenId:number;
                highlightColor:string;
                comment?:string;
            }>;
        }>;
    };
}

export class TokensLinkingModel extends StatefulModel<TokensLinkingState> {

    private pluginApi:IPluginApi;

    constructor({
            dispatcher,
            pluginApi,
            corpora

    }:TokensLinkingModelArgs) {
        super(
            dispatcher,
            {
                isBusy: false,
                corpora
            }
        );
        this.pluginApi = pluginApi;

        this.addActionHandler(
            PluginInterfaces.TokensLinking.Actions.FetchInfo,
            action => {
                this.dispatchSideEffect({
                    ...ConcActions.HighlightTokenById,
                    payload: {
                        corpusId: action.payload.corpusId,
                        tokenId: action.payload.tokenId,
                        color: null,
                        isBusy: true,
                    }
                });
                this.pluginApi.ajax$<FetchDataResponse>(
                    HTTP.Method.POST,
                    this.pluginApi.createActionUrl('/fetch_tokens_linking'),
                    {
                        ...action.payload,
                        corpname: List.head(this.state.corpora),
                        align: List.tail(this.state.corpora)
                    },
                    {
                        contentType: 'application/json'
                    }
                ).subscribe({
                    next: resp => {
                        this.dispatchSideEffect({
                            ...PluginInterfaces.TokensLinking.Actions.FetchInfoDone,
                            payload: {data: resp.data}
                        });
                        Dict.forEach((data, provider) => {
                            List.forEach(token => {
                                List.forEach(link => {
                                    this.dispatchSideEffect({
                                        ...ConcActions.HighlightTokenById,
                                        payload: {
                                            corpusId: link['corpname'],
                                            tokenId: link['tokenId'],
                                            color: link['highlightColor'],
                                            isBusy: false,
                                            comment: link['comment'],
                                        }
                                    });
                                }, token['link']);
                            }, data);
                        }, resp.data);
                    },
                    error: error => {
                        this.dispatchSideEffect({
                            ...ConcActions.HighlightTokenById,
                            payload: {
                                corpusId: action.payload.corpusId,
                                tokenId: action.payload.tokenId,
                                color: null,
                                isBusy: false,
                            }
                        });
                        this.dispatchSideEffect({
                            ...PluginInterfaces.TokensLinking.Actions.FetchInfoDone,
                            error
                        });
                    }
                });
            }
        );

        this.addActionHandler(
            PluginInterfaces.TokensLinking.Actions.FetchInfoDone,
            action => {
                if (action.error) {
                    this.pluginApi.showMessage('error', action.error);

                } else {
                }
            }
        )
    }
}