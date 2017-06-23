/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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


export function init(dispatcher, mixins, SubcmixerComponent, textTypesStore, liveAttrsStore) {

    // ----------------------------- <SelectionSteps /> --------------------------

    const SelectionSteps = React.createClass({

        mixins : mixins,

        _shortenValues : function (values, joinChar) {
            let ans;
            if (values.length > 5) {
                ans = values.slice(0, 2);
                ans.push('\u2026');
                ans = ans.concat(values.slice(values.length - 2, values.length));

            } else {
                ans = values;
            }
            return ans
                .map(item => item.substr(0, 1) !== '@' ? item : item.substr(1))
                .join(joinChar);
        },

        _renderAlignedLangsSel : function (item) {
            return (
                <span>
                {this._shortenValues(item.languages, ' + ')}
                <br />
                </span>
            );
        },

        _renderTextTypesSel : function (item) {
            return item.attributes.map((attr, i) => {
                return (
                    <span key={i}>
                        {i > 0 ? ', ' : ''}
                        <strong>{attr}</strong>
                            {'\u00a0\u2208\u00a0'}
                            {'{' + this._shortenValues(item.values.get(attr), ', ') + '}'}
                            <br />
                    </span>
                );
            });
        },

        _renderLoading : function (idx) {
            return (
                <div className="step-block">
                    <table className="step">
                        <tbody>
                            <tr>
                                <td className="num">{idx}</td>
                                <td className="data">
                                    <img src={this.createStaticUrl('img/ajax-loader-bar.gif')} alt={this.translate('global__loading')} />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            );
        },

        render : function () {
            return (
                <div className="steps">
                {this.props.items.map((item, i) => {
                    return (
                        <div className="step-block" key={i}>
                            <table className="step">
                                <tbody>
                                    <tr>
                                        <td className="num">{item.num}</td>
                                        <td className="data">
                                            {i > 0 ? '\u2026\u00a0&\u00a0' : ''}
                                            {item.num === 1 && item['languages']
                                                ? this._renderAlignedLangsSel(item)
                                                : this._renderTextTypesSel(item)
                                            }
                                            {item.numPosInfo
                                                ? this.translate('ucnkLA__num_positions', {num_pos: item.numPosInfo})
                                                : null}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    );
                })}
                {this.props.isLoading ? this._renderLoading(this.props.items.length + 1) : null}
                </div>
            );
        }
    });

    // ----------------------------- <RefineButton /> --------------------------

    const RefineButton = React.createClass({

        mixins : mixins,

        render : function () {
            if (this.props.enabled) {
                return (
                    <a className="util-button" onClick={this.props.clickHandler('refine')}>
                        {this.translate('ucnkLA__refine_selection_btn')}
                    </a>
                );

            } else {
                return <a className="util-button disabled">{this.translate('ucnkLA__refine_selection_btn')}</a>
            }
        }
    });

    // ----------------------------- <ResetButton /> --------------------------

    const ResetButton = React.createClass({

        mixins : mixins,

        render : function () {
            if (this.props.enabled) {
                return (
                    <a className="util-button cancel" onClick={this.props.clickHandler('reset')}>
                        {this.translate('ucnkLA__reset_selection_btn')}
                    </a>
                );

            } else {
                return <a className="util-button cancel disabled">{this.translate('ucnkLA__reset_selection_btn')}</a>
            }
        }
    });

    // ----------------------------- <LiveAttrsView /> --------------------------

    const LiveAttrsView = React.createClass({

        mixins : mixins,

        _mkClickHandler : function (action) {
            const actionMap = {
                refine: 'LIVE_ATTRIBUTES_REFINE_CLICKED',
                reset: 'LIVE_ATTRIBUTES_RESET_CLICKED',
            }
            return (evt) => {
                this.setState(React.addons.update(this.state, {isLoading: {$set: true}}));
                dispatcher.dispatch({
                    actionType: actionMap[action],
                    props: {}
                });
            }
        },

        _changeHandler : function () {
            this.setState({
                selectionSteps: liveAttrsStore.getSelectionSteps(),
                alignedCorpora: liveAttrsStore.getAlignedCorpora(),
                isLoading: false,
                controlsEnabled: liveAttrsStore.getControlsEnabled()
            })
        },

        componentDidMount : function () {
            textTypesStore.addChangeListener(this._changeHandler);
            liveAttrsStore.addChangeListener(this._changeHandler);
        },

        componentWillUnmount : function () {
            textTypesStore.removeChangeListener(this._changeHandler);
            liveAttrsStore.removeChangeListener(this._changeHandler);
        },

        _widgetIsActive : function () {
            return this.state.alignedCorpora.size > 0 && this.state.selectionSteps.length > 1
                || this.state.alignedCorpora.size === 0 && this.state.selectionSteps.length > 0;
        },

        getInitialState : function () {
            return {
                selectionSteps: liveAttrsStore.getSelectionSteps(),
                alignedCorpora: liveAttrsStore.getAlignedCorpora(),
                isLoading: false,
                controlsEnabled: liveAttrsStore.getControlsEnabled()
            };
        },

        render : function () {
            return (
                <div className="live-attributes">
                    <ul className="controls">
                        <li>
                            <RefineButton enabled={this.state.controlsEnabled} clickHandler={this._mkClickHandler} />
                        </li>
                        <li>
                            <ResetButton enabled={this.state.controlsEnabled} clickHandler={this._mkClickHandler} />
                        </li>
                        {SubcmixerComponent ?
                            (<li>
                                <SubcmixerComponent isActive={this._widgetIsActive()} />
                            </li>)
                        : null}
                    </ul>
                    <SelectionSteps items={this.state.selectionSteps} isLoading={this.state.isLoading} />
                </div>
            );
        }
    });

    // ----------------------------- <AlignedLangItem /> --------------------------

    let AlignedLangItem = React.createClass({

        mixins : mixins,

        _clickHandler : function () {
            dispatcher.dispatch({
                actionType: 'LIVE_ATTRIBUTES_ALIGNED_CORP_CHANGED',
                props: {
                    idx: this.props.itemIdx
                }
            });
        },

        render : function () {
            return (
                <label>
                    {this.props.item.locked ?
                        <input type="hidden" name="aligned_corpora" value={this.props.item.value} />
                        : null
                    }
                    <input type="checkbox" className="aligned-lang" name="aligned_corpora"
                            onChange={this._clickHandler} checked={this.props.item.selected}
                            value={this.props.item.value} disabled={this.props.item.locked}
                            title={this.props.manualAlignCorporaMode ? '' : this.translate('ucnkLA__aligned_lang_cannot_be_set_here') } />
                    {'\u00a0'}{this.props.item.label}
                </label>
            );
        }
    });

    // ----------------------------- <LiveAttrsCustomTT /> --------------------------

    let LiveAttrsCustomTT = React.createClass({

        mixins : mixins,

        _changeHandler : function (store, action) {
            this.setState({
                alignedCorpora: liveAttrsStore.getAlignedCorpora(),
                isLocked: store.hasLockedAlignedLanguages()
            });
        },

        getInitialState : function () {
            return {
                alignedCorpora: liveAttrsStore.getAlignedCorpora(),
                isLocked: liveAttrsStore.hasLockedAlignedLanguages()
            };
        },

        componentDidMount : function () {
            liveAttrsStore.addChangeListener(this._changeHandler);
        },

        componentWillUnmount : function () {
            liveAttrsStore.removeChangeListener(this._changeHandler);
        },

        render : function () {
            if (this.state.alignedCorpora.size === 0) {
                return null;

            } else {
                let classes = ['envelope', 'aligned'];
                if (this.state.isLocked) {
                    classes.push('locked');
                }
                return (
                    <table className={classes.join(' ')}>
                        <tbody>
                            <tr className="attrib-name">
                                <th>
                                    {this.translate('ucnkLA__aligned_corpora')}
                                </th>
                            </tr>
                            <tr>
                                <td className="note">
                                    <p>({this.translate('ucnkLA__subcorp_consider_aligned_corpora')})</p>
                                </td>
                            </tr>
                            <tr>
                                <td className="data-rows">
                                    <div className="scrollable">
                                        <table>
                                            <tbody>
                                                {this.state.alignedCorpora.map((item, i) => {
                                                    return (
                                                        <tr key={item.value}>
                                                            <td>
                                                                <AlignedLangItem item={item} itemIdx={i}
                                                                    manualAlignCorporaMode={this.props.manualAlignCorporaMode} />
                                                            </td>
                                                            <td />
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td className="hidden-values">
                                </td>
                            </tr>
                            <tr className="last-line">
                                <td>{'\u00a0'}</td>
                            </tr>
                        </tbody>
                    </table>
                );
            }
        }
    });

    return {
        LiveAttrsView: LiveAttrsView,
        LiveAttrsCustomTT: LiveAttrsCustomTT
    };

}