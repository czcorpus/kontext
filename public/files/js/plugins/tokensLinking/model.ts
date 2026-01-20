/*
 * Copyright (c) 2023 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import * as PluginInterfaces from '../../types/plugins/index.js';
import { StatefulModel, IFullActionControl } from 'kombo';
import { IPluginApi } from '../../types/plugins/common.js';
import { Dict, HTTP, List, Rx, pipe, tuple } from 'cnc-tskit';
import { AjaxResponse } from '../../types/kontext.js';
import { AttrSet } from '../../types/plugins/tokensLinking.js';
import { Actions as ConcActions } from '../../models/concordance/actions.js';
import { HighlightInfo, TokenLink } from '../../models/concordance/common.js';



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
            link:Array<TokenLink>;
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
            PluginInterfaces.TokensLinking.Actions.FetchInfo,
            action => {
                this.dispatchSideEffect(
                    ConcActions.HighlightTokens,
                    {
                        highlights: [{
                            corpusId: action.payload.corpusId,
                            tokenId: action.payload.tokenId,
                            lineId: action.payload.lineId,
                            clickedTokenId: action.payload.tokenId,
                            color: null,
                            altColors: [],
                            isBusy: true
                        }],
                        scrollY: action.payload.scrollY
                    }
                );
                Rx.zippedWith(
                    tuple(action.payload.corpusId, action.payload.lineId, action.payload.tokenId),
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
                    next: ([resp, [corpusId, lineId, clickedTokenId]]) => {
                        this.dispatchSideEffect(
                            PluginInterfaces.TokensLinking.Actions.FetchInfoDone,
                            {
                                corpusId,
                                lineId,
                                clickedTokenId,
                                data: pipe(
                                    resp.data,
                                    Dict.map(
                                        (data, provider) => List.flatMap(
                                            items => items.link,
                                            data
                                        )
                                    )
                                ),
                                scrollY: action.payload.scrollY
                            }
                        );
                    },
                    error: error => {
                        this.dispatchSideEffect(
                            ConcActions.HighlightTokens,
                            {
                                highlights: [{
                                    corpusId: action.payload.corpusId,
                                    lineId: action.payload.lineId,
                                    tokenId: action.payload.tokenId,
                                    clickedTokenId: action.payload.tokenId,
                                    color: null,
                                    altColors: [],
                                    isBusy: false
                                }],
                                scrollY: action.payload.scrollY
                            }
                        );
                        this.dispatchSideEffect(
                            PluginInterfaces.TokensLinking.Actions.FetchInfoDone,
                            error
                        );
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
                                (newHighlights, provider) => {
                                    const normHighlights = pipe(
                                        newHighlights,
                                        List.map(
                                            token => {
                                                const updColor = this.findUnusedColor(
                                                    state.appliedHighlights,
                                                    action.payload.lineId,
                                                    token.color,
                                                    token.altColors
                                                );
                                                return {
                                                    ...token,
                                                    color: updColor,
                                                    lineId: action.payload.lineId,
                                                    clickedTokenId: action.payload.clickedTokenId,
                                                    isBusy: false,
                                                };
                                            }
                                        ),
                                        List.forEach(
                                            token => {
                                                if (!Dict.hasKey(action.payload.lineId, state.appliedHighlights)) {
                                                    state.appliedHighlights[action.payload.lineId] = [];
                                                }
                                                state.appliedHighlights[action.payload.lineId] = List.push(
                                                    token,
                                                    state.appliedHighlights[action.payload.lineId]
                                                );
                                            }
                                        )
                                    );

                                    if (!List.empty(normHighlights)) {
                                        this.dispatchSideEffect(
                                            ConcActions.HighlightTokens,
                                            {
                                                highlights: normHighlights,
                                                scrollY: action.payload.scrollY
                                            }
                                        );

                                    } else {
                                        // clean the ajax loader in the clicked token
                                        this.dispatchSideEffect(
                                            ConcActions.HighlightTokens,
                                            {
                                                highlights: [{
                                                    corpusId: action.payload.corpusId,
                                                    lineId: action.payload.lineId,
                                                    tokenId: action.payload.clickedTokenId,
                                                    clickedTokenId: action.payload.clickedTokenId,
                                                    color: null,
                                                    altColors: [],
                                                    isBusy: false
                                                }],
                                                scrollY: action.payload.scrollY
                                            }
                                        );
                                        this.pluginApi.showMessage(
                                            'error', this.pluginApi.translate('defaultTL__matches_search_error')
                                        )
                                    }
                                },
                                action.payload.data
                            );
                        }
                    );
                }
            }
        );

        this.addActionHandler(
            PluginInterfaces.TokensLinking.Actions.DehighlightLinksById,
            action => {
                const hIndex = List.findIndex(
                    v => v.tokenId === action.payload.tokenId && v.corpusId === action.payload.corpusId,
                    this.state.appliedHighlights[action.payload.lineId]
                );
                if (hIndex !== -1) {
                    const clickedTokenId = this.state.appliedHighlights[action.payload.lineId][hIndex].clickedTokenId;
                    const dehighlights:Array<HighlightInfo> = pipe(
                        this.state.appliedHighlights[action.payload.lineId],
                        List.filter(v => v.clickedTokenId === clickedTokenId),
                    );
                    this.dispatchSideEffect(
                        ConcActions.DehighlightTokens,
                        {dehighlights},
                    );
                    this.changeState(state => {
                        state.appliedHighlights[action.payload.lineId] = List.filter(
                            v => v.clickedTokenId !== clickedTokenId,
                            state.appliedHighlights[action.payload.lineId],
                        );
                    });
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