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

/// <reference path="../../../vendor.d.ts/d3-color.d.ts" />

import * as React from 'react';
import { IActionDispatcher, BoundWithProps } from 'kombo';

import { Kontext } from '../../../types/common';
import { TextTypesDistModel, FreqItem, FreqBlock, TextTypesDistModelState } from '../../../models/concordance/ttDistModel';
import { Actions, ActionName } from '../../../models/concordance/actions';
import * as S from './style';


export interface TtOverviewViews {
    TextTypesDist:React.ComponentClass<{}>
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers, ttDistModel:TextTypesDistModel):TtOverviewViews {

    const layoutViews = he.getLayoutViews();

    const FreqBar = (props:{items:Array<FreqItem>, label:string}) => {

        const mkTitle = (v:FreqItem) => he.translate('concview__abs_ipm_bar_title_{abs}{ipm}',
                            {abs: he.formatNumber(v.abs), ipm: he.formatNumber(v.ipm)});

        return (
            <S.FreqBar>
                <div className="legend">
                    <strong>{props.label}:</strong>
                    {props.items.map((item, i) =>
                        <span key={`${i}:${item.value}`} className="item" title={mkTitle(item)}>
                            <span className="color-box" style={{color: item.color}}>{'\u25A0'}</span>
                            {item.value ? item.value : '\u2014'} </span>)
                    }
                </div>
                <div className="data">
                    {props.items.map((item, i) =>
                                <div key={`${i}:${item.value}`} className="item"
                                        style={{backgroundColor: item.color, width: `${item.barWidth}px`}}
                                        title={`${item.value}, ${mkTitle(item)}`}></div>)}
                </div>
            </S.FreqBar>
        );
    };

    // ------------------------- <FreqsNotes /> ----------------------------------

    const FreqsNotes:React.SFC<{
        blocks:Array<FreqBlock>;
        isDisplayedBlocksSubset:boolean;
        shouldDisplayBlocksSubset:boolean;
        maxChartItems:number;
        sampleSize:number;
        minFreq:number;

    }> = (props) => {

        const handleLimitRemove = () => {
            dispatcher.dispatch<Actions.RemoveChartItemsLimit>({
                name: ActionName.RemoveChartItemsLimit
            });
        };

        const handleLimitRestore = () => {
            dispatcher.dispatch<Actions.RestoreChartItemsLimit>({
                name: ActionName.RestoreChartItemsLimit
            });
        };

        return props.blocks.length > 0 ?
                <p className="note">
                    {he.translate('concview__charts_units_are')}: <strong>i.p.m.</strong>{'\u00a0|\u00a0'}
                    {he.translate('concview__using_min_freq')}: <strong>{props.minFreq}</strong>
                    {props.isDisplayedBlocksSubset ?
                        <>
                            {'\u00a0|\u00a0'}
                            {he.translate('concview__displaying_charts_up_to_{num_items}',
                                {num_items: props.maxChartItems})}
                            {'\u00a0'}(<a onClick={handleLimitRemove}>{he.translate('concview__display_all_tt_charts')}</a>)
                        </> :
                        null
                    }
                    {!props.isDisplayedBlocksSubset && props.shouldDisplayBlocksSubset ?
                        <>
                            {'\u00a0|\u00a0'}
                            {he.translate('concview__display_limited_tt_charts')}{'\u00a0'}
                            (<a onClick={handleLimitRestore}>{he.translate('global__yes')}</a>)
                        </> :
                        null
                    }
                    {props.sampleSize > 0 ?
                        '\u00a0|\u00a0' + he.translate('concview__using_sample_{value}',
                                {value: props.sampleSize}) + '.' : ''
                    }
                </p> : null;
    };

    /**
     *
     */
    class TextTypesDist extends React.PureComponent<TextTypesDistModelState> {

        componentDidMount() {
            dispatcher.dispatch<Actions.LoadTTDictOverview>({
                name: ActionName.LoadTTDictOverview
            });

        }

        render() {
            const blocks = TextTypesDistModel.getDisplayableBlocks(this.props);
            return (
                <div className="TextTypesDist">
                    <h3 className="block">
                        {he.translate('concview__freqs_overview_heading')}
                    </h3>
                    <FreqsNotes blocks={blocks}
                                minFreq={this.props.flimit}
                                sampleSize={this.props.sampleSize}
                                maxChartItems={this.props.maxBlockItems}
                                isDisplayedBlocksSubset={TextTypesDistModel.isDisplayedBlocksSubset(this.props)}
                                shouldDisplayBlocksSubset={TextTypesDistModel.shouldDisplayBlocksSubset(this.props)} />
                    <hr />
                    <div className="contents">
                        {this.props.isBusy ?
                            <div className="loader"><layoutViews.AjaxLoaderImage /></div> :
                            <div>
                                {blocks.map((item, i) => <FreqBar key={`freq:${i}`} items={item.items} label={item.label} />)}
                            </div>
                        }
                    </div>
                </div>
            );
        }

    }

    return {
        TextTypesDist: BoundWithProps(TextTypesDist, ttDistModel)
    };
}