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
import { IActionDispatcher} from 'kombo';

import { Kontext } from '../../../types/common';
import { Freq2DFlatViewModel, FreqDataItem } from '../../../models/freqs/twoDimension/flatTable';
import { FreqFilterQuantities } from '../../../models/freqs/twoDimension/common';
import { init as ctViewOptsFactory } from './viewOpts';
import { Freq2DTableModelState } from '../../../models/freqs/twoDimension/table2d';

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

    /**
     *
     * @param {*} props
     */
    const TRFlatListRow = (props) => {

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

        return (
            <tr>
                <td className="num">{props.idx}.</td>
                <td>
                    <a href={props.data.pfilter}>p</a>
                </td>
                <td>{props.data.val1}</td>
                <td>{props.data.val2}</td>
                <td className="num" title={formatRange(props.data.absConfInterval)}>
                    {renderWarning()}
                    {props.data.abs}
                </td>
                {props.canProvideIpm ?
                    <td className="num" title={formatRange(props.data.ipmConfInterval)}>
                        {renderWarning()}
                        {props.data.ipm}
                    </td> :
                    null
                }
            </tr>
        );
    }

    /**
     *
     * @param {*} props
     */
    const THSortableCol = (props) => {

        const handleClick = () => {
            dispatcher.dispatch({
                name: 'FREQ_CT_SORT_FLAT_LIST',
                payload: {
                    value: props.value,
                    reversed: props.isActive ? !props.isReversed : false
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
            <th className="sort-col">
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
    class CTFlatFreqResultView extends React.PureComponent<Freq2DTableModelState> {


        constructor(props) {
            super(props);
        }

        render() {
            return (
                <div className="CTFlatFreqResultView">
                    <div className="toolbar">
                        <form>
                            <fieldset>
                                <legend>{he.translate('freq__ct_data_parameters_legend')}</legend>
                                <div>
                                    <ul className="items">
                                        <li>
                                            <ctViewOpts.MinFreqInput currVal={this.props.minFreq} freqType={this.props.minFreqType}
                                                    canProvideIpm={this.props.canProvideIpm} />
                                        </li>
                                        <li>
                                            <ctViewOpts.AlphaLevelSelect alphaLevel={this.props.alphaLevel}
                                                    availAlphaLevels={this.props.availAlphaLevels}
                                                    confIntervalLeftMinWarn={this.props.confIntervalLeftMinWarn} />
                                        </li>
                                    </ul>
                                </div>
                            </fieldset>
                        </form>
                    </div>
                    <table className="data">
                        <tbody>
                            <tr>
                                <th />
                                <th>
                                    {he.translate('freq__ct_filter_th')}
                                </th>
                                <THSortableCol label={this.props.attr1} value={this.props.attr1}
                                        isActive={this.props.sortCol === this.props.attr1}
                                        isReversed={this.props.sortCol === this.props.attr1 && this.props.sortColIsReversed}
                                            />
                                <th>{this.props.attr2}</th>
                                <THSortableCol label={he.translate('freq__ct_abs_freq_label')}
                                        value="abs" isActive={this.props.sortCol === 'abs'}
                                        isReversed={this.props.sortCol === 'abs' && this.props.sortColIsReversed}
                                        />
                                {this.state.canProvideIpm ?
                                    <THSortableCol label={he.translate('freq__ct_ipm_freq_label')}
                                            value="ipm" isActive={this.props.sortCol === 'ipm'}
                                            isReversed={this.props.sortCol === 'ipm' && this.props.sortColIsReversed} /> :
                                    null
                                }
                            </tr>
                            {this.props.data.map((item, i) =>
                                <TRFlatListRow key={`r_${i}`} idx={i+1} data={item}
                                        confIntervalLeftMinWarn={this.props.confIntervalLeftMinWarn}
                                        canProvideIpm={this.props.canProvideIpm} />)}
                        </tbody>
                    </table>
                </div>
            );
        }
    }

    return {
        CTFlatFreqResultView: CTFlatFreqResultView
    };

}