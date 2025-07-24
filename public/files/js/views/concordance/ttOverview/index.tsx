/*
 * Copyright (c) 2018 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import * as React from 'react';
import { IActionDispatcher, Bound } from 'kombo';

import * as Kontext from '../../../types/kontext.js';
import { TextTypesDistModel, TextTypesDistModelState } from '../../../models/concordance/ttdist/model.js';
import { Actions } from '../../../models/concordance/actions.js';
import * as S from './style.js';
import { FreqBlock, FreqItem } from '../../../models/concordance/ttdist/common.js';
import { List } from 'cnc-tskit';


export interface TtOverviewViews {
    TextTypesDist:React.ComponentClass<{}>
}


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    ttDistModel:TextTypesDistModel
):TtOverviewViews {

    const layoutViews = he.getLayoutViews();

    const FreqBar = (props:{items:Array<FreqItem>, label:string}) => {

        const mkTitle = (v:FreqItem) => he.translate('concview__abs_ipm_bar_title_{abs}{ipm}',
                            {abs: he.formatNumber(v.abs), ipm: he.formatNumber(v.ipm)});

        return (
            <S.FreqBar>
                <div className="legend">
                    <strong>{props.label}:</strong>
                    {List.map(
                        (item, i) =>
                            <span key={`${i}:${item.value}`} className="item" title={mkTitle(item)}>
                                <span className="color-box" style={{color: item.color}}>{'\u25A0'}</span>
                                {item.value ? item.value : '\u2014'} </span>,
                        props.items
                    )}
                </div>
                <div className="data">
                    {List.map(
                        (item, i) =>
                                <div key={`${i}:${item.value}`} className="item"
                                        style={{backgroundColor: item.color, width: `${item.barWidth}px`}}
                                        title={`${item.value}, ${mkTitle(item)}`}></div>,
                        props.items
                    )}
                </div>
            </S.FreqBar>
        );
    };

    // ------------------------- <FreqsNotes /> ----------------------------------

    const FreqsNotes:React.FC<{
        blocks:Array<FreqBlock>;
        isDisplayedBlocksSubset:boolean;
        shouldDisplayBlocksSubset:boolean;
        maxChartItems:number;
        sampleSize:number;
        minFreq:number;

    }> = (props) => {

        const handleLimitRemove = () => {
            dispatcher.dispatch<typeof Actions.RemoveChartItemsLimit>({
                name: Actions.RemoveChartItemsLimit.name
            });
        };

        const handleLimitRestore = () => {
            dispatcher.dispatch<typeof Actions.RestoreChartItemsLimit>({
                name: Actions.RestoreChartItemsLimit.name
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
            dispatcher.dispatch<typeof Actions.LoadTTDictOverview>({
                name: Actions.LoadTTDictOverview.name
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
        TextTypesDist: Bound(TextTypesDist, ttDistModel)
    };
}