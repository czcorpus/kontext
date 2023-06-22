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
import { StatefulModel, IFullActionControl, ExtractPayload } from 'kombo';
import { IPluginApi } from '../../types/plugins/common';
import { Dict, HTTP, List, Rx, pipe, tuple } from 'cnc-tskit';
import { AjaxResponse } from '../../types/kontext';
import { AttrSet } from '../../types/plugins/tokensLinking';
import { Actions as ConcActions } from '../../models/concordance/actions';
import { HighlightInfo } from '../../models/concordance/common';



export interface TokensLinkingState {
    corpora:Array<string>;
    isBusy:boolean;
    appliedHighlights:PluginInterfaces.TokensLinking.AppliedHighlights;
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
            link:Array<HighlightInfo>;
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
                corpora,
                appliedHighlights: {},
                isBusy: false
            }
        );
        this.pluginApi = pluginApi;

        this.addActionHandler(
            ConcActions.HighlightTokens,
            action => {
                this.changeState(
                    state => {
                        List.forEach(
                            h => {
                                if (!h.color) {
                                    state.appliedHighlights[h.lineId] = [];
                                }
                            },
                            action.payload.highlights
                        )
                    }
                );
            }
        );

        this.addActionHandler(
            PluginInterfaces.TokensLinking.Actions.FetchInfo,
            action => {
                this.dispatchSideEffect(
                    ConcActions.HighlightTokens,
                    {
                        highlights: [{
                            corpusId: action.payload.corpusId,
                            tokenId: action.payload.tokenId,
                            color: null,
                            isBusy: true,
                        }]
                    }
                );
                Rx.zippedWith(
                    tuple(action.payload.lineId, action.payload.tokenId),
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
                    )
                ).subscribe({
                    next: ([resp, [lineId, clickedTokenId]]) => {
                        this.dispatchSideEffect({
                            ...PluginInterfaces.TokensLinking.Actions.FetchInfoDone,
                            payload: {
                                lineId,
                                data: pipe(
                                    resp.data,
                                    Dict.map(
                                        (v, k) => List.map(
                                            item => ({
                                                ...item,
                                                link: List.map(
                                                    lnk => ({
                                                        ...lnk,
                                                        lineId,
                                                        clickedTokenId
                                                    }),
                                                    item.link
                                                )
                                            }),
                                            v
                                        )
                                    )
                                )
                            }
                        });
                    },
                    error: error => {
                        this.dispatchSideEffect(
                            ConcActions.HighlightTokens,
                            {
                                highlights: [{
                                    corpusId: action.payload.corpusId,
                                    lineId: action.payload.lineId,
                                    tokenId: action.payload.tokenId,
                                    color: null,
                                    altColors: [],
                                    isBusy: false
                                }]
                            }
                        );
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
                    this.changeState(
                        state => {
                            Dict.forEach(
                                (data, provider) => {
                                    List.forEach(
                                        token => {
                                            const updColor = this.findUnusedColor(
                                                state.appliedHighlights,
                                                action.payload.lineId,
                                                List.head(token.link).color,
                                                List.head(token.link).altColors,
                                                    // TODO vvv here we break original functionality specs.
                                            );
                                            const highlights:Array<HighlightInfo> = pipe(
                                                token.link,
                                                List.map(
                                                    link => ({
                                                        ...link,
                                                        color: updColor
                                                    })
                                                )
                                            );
                                            if (!Dict.hasKey(action.payload.lineId, state.appliedHighlights)) {
                                                state.appliedHighlights[action.payload.lineId] = [];
                                            }
                                            state.appliedHighlights[action.payload.lineId] = List.push(
                                                List.head(highlights),
                                                state.appliedHighlights[action.payload.lineId]
                                            );
                                            // TODO again - here we assume that each link color is the same
                                            this.dispatchSideEffect(
                                                ConcActions.HighlightTokens,
                                                {highlights}
                                            );

                                        },
                                        data
                                    );
                                },
                                action.payload.data
                            );
                        }
                    );
                }
            }
        );
    }

    private findUnusedColor(
        appliedHighlights:PluginInterfaces.TokensLinking.AppliedHighlights,
        lineId:number,
        currColor:string,
        avail:Array<string>
    ):string {
        const curr = appliedHighlights[lineId] || [];
        const colorUsage = pipe(
            avail,
            List.unshift(currColor),
            List.foldl(
                (acc, curr) => {
                    return {
                        ...acc,
                        [curr]: acc[curr] !== undefined ? acc[curr] : 0
                    };
                },
                pipe(
                    curr,
                    List.map(x => tuple(x.color, 1)),
                    List.groupBy(([color, num]) => color),
                    List.map(([v, items]) => tuple(v, List.foldl((a, [,num]) => a + num, 0, items))),
                    Dict.fromEntries()
                )
            ),
            Dict.toEntries(),
            List.sorted(([v1, n1], [v2, n2]) => n1 - n2)
        );
        return colorUsage[0][0];
    }
}