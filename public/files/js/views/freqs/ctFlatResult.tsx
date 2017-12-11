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

/// <reference path="../../vendor.d.ts/react.d.ts" />
/// <reference path="../../vendor.d.ts/immutable.d.ts" />
/// <reference path="../../types/common.d.ts" />

import * as React from 'vendor/react';
import {CTFlatStore, FreqDataItem} from '../../stores/freqs/flatCtable';
import {FreqFilterQuantities} from '../../stores/freqs/ctFreqForm';
import {init as ctViewOptsFactory} from './ctViewOpts';

// ----------------------- exported types ------------------------------------

interface CTFlatFreqResultViewProps {}

interface CTFlatFreqResultViewState {
    data:Immutable.List<FreqDataItem>;
    attr1:string;
    attr2:string;
    minFreq:string;
    minFreqType:FreqFilterQuantities;
    sortCol:string;
    sortColIsReversed:boolean;
    confIntervalLeftMinWarn:number;
    alphaLevel:string;
    availAlphaLevels:Immutable.List<[string, string]>;
    canProvideIpm:boolean;
}

interface Views {
    CTFlatFreqResultView:React.ComponentClass<CTFlatFreqResultViewProps, CTFlatFreqResultViewState>;
}

// ------------------------- factory -----------------------------------------

export function init(
            dispatcher:Kontext.FluxDispatcher,
            he:Kontext.ComponentHelpers,
            ctFlatFreqDataRowsStore:CTFlatStore):Views {

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
                actionType: 'FREQ_CT_SORT_FLAT_LIST',
                props: {
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
    class CTFlatFreqResultView extends React.Component<CTFlatFreqResultViewProps, CTFlatFreqResultViewState> {

        constructor(props) {
            super(props);
            this.state = this._fetchStoreState();
            this._handleStoreChange = this._handleStoreChange.bind(this);
        }

        _fetchStoreState() {
            return {
                data: ctFlatFreqDataRowsStore.getData(),
                attr1: ctFlatFreqDataRowsStore.getAttr1(),
                attr2: ctFlatFreqDataRowsStore.getAttr2(),
                minFreq: ctFlatFreqDataRowsStore.getMinFreq(),
                minFreqType: ctFlatFreqDataRowsStore.getMinFreqType(),
                sortCol: ctFlatFreqDataRowsStore.getSortCol(),
                sortColIsReversed: ctFlatFreqDataRowsStore.getSortColIsReversed(),
                confIntervalLeftMinWarn: ctFlatFreqDataRowsStore.getConfIntervalLeftMinWarn(),
                alphaLevel: ctFlatFreqDataRowsStore.getAlphaLevel(),
                availAlphaLevels: ctFlatFreqDataRowsStore.getAvailAlphaLevels(),
                canProvideIpm: ctFlatFreqDataRowsStore.canProvideIpm()
            };
        }

        _handleStoreChange() {
            this.setState(this._fetchStoreState());
        }

        componentDidMount() {
            ctFlatFreqDataRowsStore.addChangeListener(this._handleStoreChange);
        }

        componentWillUnmount() {
            ctFlatFreqDataRowsStore.removeChangeListener(this._handleStoreChange);
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
                                            <ctViewOpts.MinFreqInput currVal={this.state.minFreq} freqType={this.state.minFreqType}
                                                    canProvideIpm={this.state.canProvideIpm} />
                                        </li>
                                        <li>
                                            <ctViewOpts.AlphaLevelSelect alphaLevel={this.state.alphaLevel}
                                                    availAlphaLevels={this.state.availAlphaLevels}
                                                    confIntervalLeftMinWarn={this.state.confIntervalLeftMinWarn} />
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
                                <THSortableCol label={this.state.attr1} value={this.state.attr1}
                                        isActive={this.state.sortCol === this.state.attr1}
                                        isReversed={this.state.sortCol === this.state.attr1 && this.state.sortColIsReversed}
                                            />
                                <th>{this.state.attr2}</th>
                                <THSortableCol label={he.translate('freq__ct_abs_freq_label')}
                                        value="abs" isActive={this.state.sortCol === 'abs'}
                                        isReversed={this.state.sortCol === 'abs' && this.state.sortColIsReversed}
                                        />
                                {this.state.canProvideIpm ?
                                    <THSortableCol label={he.translate('freq__ct_ipm_freq_label')}
                                            value="ipm" isActive={this.state.sortCol === 'ipm'}
                                            isReversed={this.state.sortCol === 'ipm' && this.state.sortColIsReversed} /> :
                                    null
                                }
                            </tr>
                            {this.state.data.map((item, i) =>
                                <TRFlatListRow key={`r_${i}`} idx={i+1} data={item}
                                        confIntervalLeftMinWarn={this.state.confIntervalLeftMinWarn}
                                        canProvideIpm={this.state.canProvideIpm} />)}
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