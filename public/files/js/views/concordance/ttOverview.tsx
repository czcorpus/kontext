/*
 * Copyright (c) 2018 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

/// <reference path="../../vendor.d.ts/react.d.ts" />
/// <reference path="../../vendor.d.ts/immutable.d.ts" />
/// <reference path="../../vendor.d.ts/d3-color.d.ts" />
/// <reference path="../../types/common.d.ts" />

import * as React from 'vendor/react';
import * as d3Color from 'vendor/d3-color';
import {TextTypesDistStore, FreqItem, FreqBlock} from '../../stores/concordance/ttDistStore';


export interface TextTypesProps {

}

export interface TextTypesState {
    blocks:Immutable.List<FreqBlock>;
    minFreq:number;
    isBusy:boolean;
    sampleSize:number;
}

export interface Views {
    TextTypesDist:React.Component<TextTypesProps, TextTypesState>
}


export function init(dispatcher:Kontext.FluxDispatcher, he:Kontext.ComponentHelpers, ttDistStore:TextTypesDistStore) {

    const layoutViews = he.getLayoutViews();

    const colors = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
                    "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];

    const FreqBar = (props:{items:Array<FreqItem>, label:string}) => {
        return (
            <div className="FreqBar">
                <div className="legend">
                    <strong>{props.label}:</strong>
                    {props.items.map((item, i) =>
                        <span key={`${i}:${item.fbar}`} className="item">
                            <span className="color-box" style={{color: colors[i]}}>{'\u25A0'}</span>
                            {item.Word[0].n ? item.Word[0].n : '\u2014'}
                        </span>)
                    }
                </div>
                <div className="data">
                    {props.items.map((item, i) =>
                                <div key={`${i}:${item.fbar}`} className="item" style={{backgroundColor: colors[i], width: `${item.fbar}px`}}></div>)}
                </div>
            </div>
        );
    };

    /**
     *
     */
    const FreqsView = (props:{blocks:Immutable.List<FreqBlock>, minFreq:number, sampleSize:number}) => {
        return (
            <div>
                {props.blocks.map((item, i) => <FreqBar key={`freq:${i}`} items={item.Items} label={item.Head[0].n} />)}
                <p className="note">
                    {he.translate('concview__using_min_freq_{value}', {value: props.minFreq})}.
                    {props.sampleSize > 0 ?
                        ' ' + he.translate('concview__using_sample_{value}', {value: props.sampleSize}) + '.' : ''
                    }
                </p>
            </div>
        );
    };

    /**
     *
     */
    class TextTypesDist extends React.Component<TextTypesProps, TextTypesState> {

        constructor(props:TextTypesProps) {
            super(props);
            this.state = this._fetchStoreState();
            this._handleStoreChange = this._handleStoreChange.bind(this);
        }

        _fetchStoreState():TextTypesState {
            return {
                blocks: ttDistStore.getBlocks(),
                isBusy: ttDistStore.getIsBusy(),
                minFreq: ttDistStore.getMinFreq(),
                sampleSize: ttDistStore.getSampleSize()
            };
        }

        _handleStoreChange():void {
            this.setState(this._fetchStoreState());
        }

        componentDidMount() {
            ttDistStore.addChangeListener(this._handleStoreChange);
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_LOAD_TT_DIST_OVERVIEW',
                props: {}
            });
        }

        componentWillUnmount() {
            ttDistStore.removeChangeListener(this._handleStoreChange);
        }


        render() {
            return (
                <div className="TextTypesDist">
                    <h2>{he.translate('concview__text_types_ratios_head')}</h2>
                    <div className="contents">
                        {this.state.isBusy ?
                            <div className="loader"><layoutViews.AjaxLoaderImage /></div> :
                            <FreqsView blocks={this.state.blocks} minFreq={this.state.minFreq}
                                sampleSize={this.state.sampleSize} />
                        }
                    </div>
                </div>
            );
        }

    }

    return {
        TextTypesDist: TextTypesDist
    };
}