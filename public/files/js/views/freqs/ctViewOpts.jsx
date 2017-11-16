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

import * as React from 'vendor/react';

/**
 * Shared (between "flat" and "2d" views) view options
 *
 * @param {*} dispatcher
 * @param {*} he
 */
export function init(dispatcher, he) {
    /**
     *
     */
    const MinFreqInput = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'FREQ_CT_SET_MIN_FREQ',
                props: {value: evt.target.value}
            });
        };

        const handleTypeChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'FREQ_CT_SET_MIN_FREQ_TYPE',
                props: {value: evt.target.value}
            });
        };

        return (
            <label>
                {he.translate('freq__ct_min_freq_label')}
                {'\u00a0'}
                <select onChange={handleTypeChange} value={props.freqType}>
                    <option value="abs">{he.translate('freq__ct_min_abs_freq_opt')}</option>
                    {props.canProvideIpm ?
                        <option value="ipm">{he.translate('freq__ct_min_ipm_opt')}</option> :
                        null
                    }
                </select>
                {'\u00a0'}:{'\u00a0'}
                <input type="text" style={{width: '3em'}} value={props.currVal}
                        onChange={handleInputChange} />
            </label>
        );
    };

    /**
     *
     * @param {*} props
     */
    class AlphaLevelSelect extends React.Component {

        constructor(props) {
            super(props);
            this._onChange = this._onChange.bind(this);
            this._onHintClick = this._onHintClick.bind(this);
            this._onHintCloseClick = this._onHintCloseClick.bind(this);
            this.state = {hintVisible: false};
        }

        _onChange(evt) {
            dispatcher.dispatch({
                actionType: 'FREQ_CT_SET_ALPHA_LEVEL',
                props: {
                    value: evt.target.value
                }
            });
        }

        _onHintClick() {
            this.setState({hintVisible: true});
        }

        _onHintCloseClick() {
            this.setState({hintVisible: false});
        }

        render() {

            return (
                <span>
                    <label htmlFor="confidence-level-selection">
                        {he.translate('freq__ct_conf_level_label')}
                    </label>
                    <span>
                        <sup className="hint" onClick={this._onHintClick}>
                            <img src={he.createStaticUrl('img/info-icon.svg')}
                                    alt={he.translate('global__info_icon')} />
                        </sup>
                        {this.state.hintVisible ?
                            <ConfidenceIntervalHint onCloseClick={this._onHintCloseClick}
                                confIntervalLeftMinWarn={this.props.confIntervalLeftMinWarn} /> :
                            null
                        }
                    </span>
                    :{'\u00a0'}
                    <select id="confidence-level-selection" value={this.props.alphaLevel} onChange={this._onChange}>
                        {this.props.availAlphaLevels.map(item =>
                            <option key={item[0]} value={item[0]}>{item[1]}</option>)}
                    </select>
                </span>
            );
        }
    };

    return {
        MinFreqInput: MinFreqInput,
        AlphaLevelSelect: AlphaLevelSelect
    };

}