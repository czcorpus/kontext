/*
 * Copyright (c) 2015 Institute of the Czech National Corpus
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
import $ from 'jquery';


export function init(dispatcher, mixins, layoutViews, subcMixerStore) {

    // ------------ <ValueShare /> -------------------------------------

    const ValueShare = React.createClass({

        mixins,

        getInitialState : function () {
            return {
                share: ''
            }
        },

        _handleChange : function (evt) {
            this.setState({
                share: evt.target.value
            });
        },

        render : function () {
            return (
                <tr>
                    <td className="num">{this.props.rowId})</td>
                    <td>
                        <strong>{this.props.attr.label} = </strong>
                        {'\u0022' + this.props.val.value + '\u0022'} <strong>{'\u2192'}</strong></td>
                    <td>
                        <select onChange={this._handleChange} value={this.state.share}>
                            <option value="">{this.translate('ucnk_subcm__any_share')}</option>
                            <option value="lte">{'\u2264'}</option>
                            <option value="gte">{'\u2265'}</option>
                        </select>
                    </td>
                    <td>
                        {this.state.share !== '' ?
                            <span><input type="text" style={{width: '3em'}} /> <strong>%</strong></span>  : null }
                    </td>
                </tr>
            );
        }
    });

    // ------------ <ValuesTable /> -------------------------------------

    const ValuesTable = React.createClass({

        mixins : mixins,

        _handleSelectChange : function () {

        },

        render : function () {
            return (
                <table>
                    <tbody>
                        {this.props.items.map((item, i) => (
                            <ValueShare key={i} rowId={i + 1} attr={item.attr} val={item.val} />
                        ))}
                    </tbody>
                </table>
            );
        }

    });

    // ------------ <SubcMixer /> -------------------------------------

    const SubcMixer = React.createClass({

        mixins : mixins,

        render : function () {
            return (
                <layoutViews.ModalOverlay onCloseKey={this.props.closeClickHandler}>
                    <layoutViews.PopupBox customClass="subcmixer-widget"
                            onCloseClick={this.props.closeClickHandler}>
                        <div>
                            <h3>{this.translate('ucnk_subcm__widget_header')}</h3>
                            <ValuesTable items={this.props.selectedValues} />
                            <div className="controls">
                                <p>
                                    <img src={this.createStaticUrl('img/warning-icon.svg')}
                                            alt={this.translate('global__warning')}
                                            style={{width: '1em', verticalAlign: 'middle', paddingRight: '0.4em'}} />
                                    {this.translate('ucnk_subcm__calc_warn')}
                                </p>
                                <button className="default-button" type="button">
                                    {this.translate('ucnk_subcm__calculate')}
                                </button>
                            </div>
                        </div>
                    </layoutViews.PopupBox>
                </layoutViews.ModalOverlay>
            );
        }
    });

    // ------------ <TriggerBtn /> -------------------------------------

    const TriggerBtn = React.createClass({

        mixins : mixins,

        _handleTrigger : function () {
            this.setState({
                useWidget: true,
                selectedValues: subcMixerStore.getSelectedValues()
            });
        },

        _handleCloseWidget : function () {
            this.setState({
                useWidget: false,
                selectedValues: []
            });
        },

        getInitialState : function () {
            return {
                useWidget: false,
                selectedValues: []
            };
        },

        render : function () {
            return (
                <div className="mixer-trigger step-block">
                    <table className="step">
                        <tbody>
                            <tr>
                                <td className="num">?</td>
                                <td>
                                    <a className="trigger" title={this.translate('ucnk_subcm__set_shares')}
                                            onClick={this._handleTrigger}>
                                        <img src={this.createStaticUrl('js/plugins/ucnkSubcmixer/mixer.svg')} />
                                    </a>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    {this.state.useWidget ?
                        <SubcMixer closeClickHandler={this._handleCloseWidget}
                                selectedValues={this.state.selectedValues} />
                        : null}
                </div>
            );
        }
    });


    return {
        SubcMixer: SubcMixer,
        TriggerBtn: TriggerBtn
    };

}
