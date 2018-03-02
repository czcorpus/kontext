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

/// <reference path="../../vendor.d.ts/d3-color.d.ts" />

import {Kontext} from '../../types/common';
import * as React from 'react';
import * as d3Color from 'vendor/d3-color';
import * as Immutable from 'immutable';
import {TextTypesDistModel, FreqItem, FreqBlock} from '../../models/concordance/ttDistModel';
import {ActionDispatcher} from '../../app/dispatcher';


export interface TextTypesProps {

}

export interface TextTypesState {
    blocks:Immutable.List<FreqBlock>;
    minFreq:number;
    isBusy:boolean;
    sampleSize:number;
    blockedByAsyncConc:boolean;
}

export interface Views {
    TextTypesDist:React.Component<TextTypesProps, TextTypesState>
}


export function init(dispatcher:ActionDispatcher, he:Kontext.ComponentHelpers, ttDistModel:TextTypesDistModel) {

    const layoutViews = he.getLayoutViews();

    const FreqBar = (props:{items:Array<FreqItem>, label:string}) => {

        const mkTitle = (v:FreqItem) => he.translate('concview__abs_ipm_bar_title_{abs}{ipm}', {abs: v.abs, ipm: v.ipm});

        return (
            <div className="FreqBar">
                <div className="legend">
                    <strong>{props.label}:</strong>
                    {props.items.map((item, i) =>
                        <span key={`${i}:${item.value}`} className="item" title={mkTitle(item)}>
                            <span className="color-box" style={{color: item.color}}>{'\u25A0'}</span>
                            {item.value ? item.value : '\u2014'}
                        </span>)
                    }
                </div>
                <div className="data">
                    {props.items.map((item, i) =>
                                <div key={`${i}:${item.value}`} className="item"
                                        style={{backgroundColor: item.color, width: `${item.barWidth}px`}}
                                        title={`${item.value}, ${mkTitle(item)}`}></div>)}
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
                {props.blocks.map((item, i) => <FreqBar key={`freq:${i}`} items={item.items} label={item.label} />)}
                {props.blocks.size > 0 ?
                    <p className="note">
                        {he.translate('concview__using_min_freq_{value}', {value: props.minFreq})}.
                        {props.sampleSize > 0 ?
                            ' ' + he.translate('concview__using_sample_{value}', {value: props.sampleSize}) + '.' : ''
                        }
                    </p> : null
                }
            </div>
        );
    };

    /**
     *
     */
    const CloseIcon = (props) => {

        const handleClick = () => {
            if (window.confirm(
                    he.translate('concview__close_tt_overview_confirm_msg'))) {
                dispatcher.dispatch({
                    actionType: 'GENERAL_VIEW_OPTIONS_SET_TT_OVERVIEW_VISIBILITY',
                    props: {
                        value: false
                    }
                });
            }
        };

        return <a className="CloseIcon" onClick={handleClick} title={he.translate('global__close')}>
            <layoutViews.ImgWithMouseover src={he.createStaticUrl('img/close-icon.svg')} alt={he.translate('global__close')} />
        </a>;
    };

    /**
     *
     */
    class TextTypesDist extends React.Component<TextTypesProps, TextTypesState> {

        constructor(props:TextTypesProps) {
            super(props);
            this.state = this._fetchModelState();
            this._handleModelChange = this._handleModelChange.bind(this);
        }

        _fetchModelState():TextTypesState {
            return {
                blocks: ttDistModel.getBlocks(),
                isBusy: ttDistModel.getIsBusy(),
                minFreq: ttDistModel.getMinFreq(),
                sampleSize: ttDistModel.getSampleSize(),
                blockedByAsyncConc: ttDistModel.getBlockedByAsyncConc()
            };
        }

        _handleModelChange():void {
            this.setState(this._fetchModelState());
        }

        componentDidMount() {
            ttDistModel.addChangeListener(this._handleModelChange);
            if (!this.state.blockedByAsyncConc) {
                dispatcher.dispatch({
                    actionType: 'CONCORDANCE_LOAD_TT_DIST_OVERVIEW',
                    props: {}
                });
            }
        }

        componentWillUnmount() {
            ttDistModel.removeChangeListener(this._handleModelChange);
        }

        render() {
            return (
                <div className="TextTypesDist">
                    <CloseIcon />
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