/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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


import React from 'vendor/react';
import {init as corpSelViewsInit} from '../query/corpSel';


export function init(dispatcher, mixins, layoutViews, wordlistPageStore) {

    const corpSelViews = corpSelViewsInit(dispatcher, mixins);

    // ------------------- <WordListCorpSel /> -----------------------------

    const WordlistCorpSelection = React.createClass({

        _storeChangeHandler : function () {
            this.setState({
                currentSubcorp: wordlistPageStore.getCurrentSubcorpus()
            });
        },

        getInitialState : function () {
            return {
                currentSubcorp: wordlistPageStore.getCurrentSubcorpus()
            };
        },

        componentDidMount : function () {
            wordlistPageStore.addChangeListener(this._storeChangeHandler);
        },

        componentWillUnmount : function () {
            wordlistPageStore.removeChangeListener(this._storeChangeHandler);
        },

        render : function () {
            return (
                <tbody>
                    <corpSelViews.TRCorpusField subcorpList={this.props.subcorpList}
                            currentSubcorp={this.state.currentSubcorp} />
                </tbody>
            )
        }
    });

    // ------------------- <CorpInfoToolbar /> -----------------------------

    const CorpInfoToolbar = React.createClass({
        render : function () {
            return (
                <ul id="query-overview-bar">
                    <layoutViews.CorpnameInfoTrigger corpname={this.props.corpname}
                            humanCorpname={this.props.humanCorpname}
                            usesubcorp={this.props.usesubcorp} />
                </ul>
            );
        }
    });

    return {
        WordlistCorpSelection: WordlistCorpSelection,
        CorpInfoToolbar: CorpInfoToolbar
    };
}