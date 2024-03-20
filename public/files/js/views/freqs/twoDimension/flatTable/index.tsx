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

import * as React from 'react';
import { IActionDispatcher, Bound } from 'kombo';

import * as Kontext from '../../../../types/kontext';
import { Freq2DFlatViewModel, Freq2DFlatViewModelState, FreqDataItem } from '../../../../models/freqs/twoDimension/flatTable';
import { GeneralFreq2DModel } from '../../../../models/freqs/twoDimension/generalDisplay';
import { init as ctViewOptsFactory } from '../viewOpts';
import { Actions } from '../../../../models/freqs/twoDimension/actions';
import * as S from './style';
import * as S2 from '../style';


// ----------------------- exported types ------------------------------------


interface Views {
    CTFlatFreqResultView:React.ComponentClass<{}>;
}

// ------------------------- factory -----------------------------------------

export function init(
            dispatcher:IActionDispatcher,
            he:Kontext.ComponentHelpers,
            ctFlatFreqDataRowsModel:Freq2DFlatViewModel):Views {

    const ctViewOpts = ctViewOptsFactory(dispatcher, he);
    const layoutViews = he.getLayoutViews();


    const TRFlatListRow:React.FC<{
        idx:number;
        data:FreqDataItem;
        confIntervalLeftMinWarn:number;
        canProvideIpm:boolean;
        alphaLevel:string;
    }> = (props) => {

        const shouldWarn = (props) => {
                return props.data.ipmConfInterval[0] <= props.confIntervalLeftMinWarn ||
                        props.data.absConfInterval[0] <= props.confIntervalLeftMinWarn;
        };

        const formatRange = (interval) => {
            return interval.map(x => he.formatNumber(x, 1)).join('-');
        };

        const renderWarning = () => {
            if (shouldWarn(props)) {
                return (
                <strong className="warn" title={he.translate('freq__ct_conf_interval_too_uncertain')}>
                    {'\u00a0'}
                </strong>
                );

            } else {
                return '';
            }
        };

        const handlePFilter = () => {
            dispatcher.dispatch<typeof Actions.FreqctApplyQuickFilter>({
                name: Actions.FreqctApplyQuickFilter.name,
                payload: {
                    url: props.data.pfilter
                }
            });
        };

        const alphaLevelNum = (1 - parseFloat(props.alphaLevel)) * 100;
        const ciLabel = he.translate(
            'freq__ct_confidence_interval_{level}', {level: alphaLevelNum})

        return (
            <tr>
                <td className="num">{props.idx}.</td>
                <td>
                    <a onClick={handlePFilter}>p</a>
                </td>
                <td>{props.data.val1}</td>
                <td>{props.data.val2}</td>
                <td className="num" title={formatRange(props.data.absConfInterval)}>
                    {renderWarning()}
                    {props.data.abs}
                </td>
                <td title={ciLabel}>
                    <span className="bracket">[</span>
                        {props.data.absConfInterval[0]}
                        <span className="separ">, </span>
                        {props.data.absConfInterval[1]}
                    <span className="bracket">]</span>
                </td>
                {props.canProvideIpm ?
                    <>
                        <td className="num" title={formatRange(props.data.ipmConfInterval)}>
                            {renderWarning()}
                            {props.data.ipm}
                        </td>
                        <td title={ciLabel}>
                            <span className="bracket">[</span>
                            {props.data.ipmConfInterval[0]}
                            <span className="separ">, </span>
                            {props.data.ipmConfInterval[1]}
                            <span className="bracket">]</span>
                        </td>
                    </>:
                    null
                }
            </tr>
        );
    }

    /**
     *
     * @param {*} props
     */
    const THSortableCol:React.FC<{
        value:string;
        label:string;
        isActive:boolean;
        isReversed:boolean;
        colSpan:number;
    }> = (props) => {

        const handleClick = () => {
            dispatcher.dispatch<typeof Actions.FreqctSortFlatList>({
                name: Actions.FreqctSortFlatList.name,
                payload: {
                    value: props.value,
                    reversed: props.value === 'ipm' || props.value === 'abs' ? true : false
                }
            });
        };

        const renderFlag = () => {
            if (props.isActive) {
                if (props.isReversed) {
                    return <img src={he.createStaticUrl('img/sort_desc.svg')} />;

                } else {
                    return <img src={he.createStaticUrl('img/sort_asc.svg')} />;
                }
            }
            return null;
        };

        return (
            <th colSpan={props.colSpan} className="sort-col">
                <a onClick={handleClick} title={he.translate('global__sort_by_this_col')}>
                    {props.label}
                    {renderFlag()}
                </a>
            </th>
        );
    }

    /**
     *
     */
    class CTFlatFreqResultView extends React.PureComponent<Freq2DFlatViewModelState> {

        render() {
            return (
                <S.CTFlatFreqResultView>
                    <S2.FieldsetAdvancedOptions>
                        <form>
                            <layoutViews.ExpandableArea alwaysExpanded={true} initialExpanded={true}
                                    label={he.translate('freq__ct_data_parameters_legend')}>
                                <fieldset>
                                    <div>
                                        <ul className="items">
                                            <li>
                                                <ctViewOpts.MinFreqInput currVal={this.props.minFreq} freqType={this.props.minFreqType}
                                                        canProvideIpm={Freq2DFlatViewModel.canProvideIpm(this.props)} />
                                            </li>
                                            <li>
                                                <ctViewOpts.AlphaLevelSelect alphaLevel={this.props.alphaLevel}
                                                        availAlphaLevels={this.props.availAlphaLevels}
                                                        confIntervalLeftMinWarn={this.props.confIntervalLeftMinWarn} />
                                            </li>
                                        </ul>
                                    </div>
                                </fieldset>
                            </layoutViews.ExpandableArea>
                        </form>
                    </S2.FieldsetAdvancedOptions>
                    <table className="data">
                        <tbody>
                            <tr>
                                <th />
                                <th>
                                    {he.translate('freq__ct_filter_th')}
                                </th>
                                <THSortableCol colSpan={1} label={this.props.attr1} value={this.props.attr1}
                                        isActive={this.props.sortBy === this.props.attr1}
                                        isReversed={this.props.sortBy === this.props.attr1 && this.props.sortReversed}
                                            />
                                <th>{this.props.attr2}</th>
                                <THSortableCol colSpan={2} label={he.translate('freq__ct_abs_freq_label')}
                                        value="abs" isActive={this.props.sortBy === 'abs'}
                                        isReversed={this.props.sortBy === 'abs' && this.props.sortReversed}
                                        />
                                {GeneralFreq2DModel.canProvideIpm(this.props) ?
                                        <THSortableCol colSpan={2} label={he.translate('freq__ct_ipm_freq_label')}
                                                value="ipm" isActive={this.props.sortBy === 'ipm'}
                                                isReversed={this.props.sortBy === 'ipm' && this.props.sortReversed} /> :
                                    null
                                }
                            </tr>
                            {this.props.data.map((item, i) =>
                                <TRFlatListRow key={`r_${i}`} idx={i+1} data={item}
                                        confIntervalLeftMinWarn={this.props.confIntervalLeftMinWarn}
                                        canProvideIpm={GeneralFreq2DModel.canProvideIpm(this.props)}
                                        alphaLevel={this.props.alphaLevel} />)}
                        </tbody>
                    </table>
                </S.CTFlatFreqResultView>
            );
        }
    }

    return {
        CTFlatFreqResultView: Bound(CTFlatFreqResultView, ctFlatFreqDataRowsModel)
    };

}