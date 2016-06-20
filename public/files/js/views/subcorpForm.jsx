/*
 * Copyright (c) 2016 Institute of the Czech National Corpus
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


export function init(dispatcher, mixins, subcorpFormStore) {

    // ------------------------------------------- <WithinSwitch /> ----------------------------

    let WithinSwitch = React.createClass({

        _changeHandler : function () {
            this.props.changeHandler({
                target: {value: this.props.withinType === 'within' ? '!within' : 'within'}
            });
        },

        render : function () {
            return (
                <select className="code" onChange={this._changeHandler}
                        defaultValue={this.props.withinType}>
                    <option value="within">within</option>
                    <option value="!within">!within</option>
                </select>
            );
        }
    });

    // ------------------------------------------- <CloseImg /> ----------------------------

    let CloseImg = React.createClass({

        mixins: mixins,

        getInitialState : function () {
            return {img: this.createStaticUrl('img/close-icon.svg')};
        },

        _onMouseOver : function () {
            this.setState({img: this.createStaticUrl('img/close-icon_s.svg')});
        },

        _onMouseOut : function () {
            this.setState({img: this.createStaticUrl('img/close-icon.svg')});
        },

        render : function () {
            return <img className="remove-line"
                        onClick={this.props.onClick}
                        onMouseOver={this._onMouseOver}
                        onMouseOut={this._onMouseOut}
                        src={this.state.img}
                        title={this.translate('global__remove_line')} />
        }
    });

    // ---------------------------------------------------------------------------------------

    function createLineChangeHandler(attrName, rowId, transform) {
        let self = this;
        return function (evt) {
            let props = {
                row: rowId,
                negated: self.props.lineData.negated,
                structureName: self.props.lineData.structureName,
                attributeCql: self.props.lineData.attributeCql
            };
            props[attrName] = typeof transform === 'function' ? transform(evt.target.value) : evt.target.value;

            dispatcher.dispatch({
                actionType: 'LINE_UPDATED',
                props: props
            });
        };
    }

    // ------------------------------------------- <WithinLine /> ----------------------------

    let WithinLine = React.createClass({
        mixins : mixins,

        _createPrevLinkRef : function (i) {
            if (this.props.viewIdx > 0) {
                return this.translate('global__subc_all_the_matching_tokens_{prev}', {prev: i});

            } else {
                return this.translate('global__subc_all_the_tokens');
            }
        },

        render : function () {
            return (
                <tr className="within-rel">
                    <td className="line-id" rowSpan="2">{this.props.viewIdx + 1})</td>
                        <td colSpan="3">
                        <span className="set-desc">{this._createPrevLinkRef(this.props.viewIdx)}</span>
                        <WithinSwitch changeHandler={createLineChangeHandler.call(this, 'negated', this.props.rowIdx,
                                            (v)=>({'within': false, '!within': true})[v])}
                                        withinType={this.props.lineData.negated ? '!within' : 'within'} />
                        <strong>:</strong>
                    </td>
                </tr>
            );
        }
    });

    // ------------------------------------------- <StructLine /> ----------------------------

    let StructLine = React.createClass({
        mixins : mixins,

        _removeHandler : function () {
            dispatcher.dispatch({
                actionType: 'LINE_REMOVED',
                props: {rowIdx: this.props.rowIdx}
            });
        },

        _getStructHint : function (structName) {
            return (this.props.structsAndAttrs[structName] || []).join(', ');
        },

        render : function () {
            let self = this;
            return (
                <tr>
                    <td>
                        <select onChange={createLineChangeHandler.call(self, 'structureName', this.props.rowIdx)}
                            defaultValue={this.props.lineData.structureName}>
                        {
                            Object.keys(this.props.structsAndAttrs).map(
                                (item) => <option key={item}
                                                    value={item}
                                                    title={self._getStructHint(item)}>{item}</option>
                            )
                        }
                        </select>
                    </td>
                    <td>
                        <input type="text" defaultValue={this.props.lineData.attributeCql}
                                onChange={createLineChangeHandler.call(self, 'attributeCql', this.props.rowIdx)}
                                style={{width: '30em'}} />
                    </td>
                    <td>
                        { this.props.rowIdx > 0
                            ? <CloseImg onClick={this._removeHandler} /> : null
                        }
                    </td>
                </tr>
            );
        }
    });

    // ------------------------------------------- <WithinBuilder /> ----------------------------

    let WithinBuilder = React.createClass({

        mixins: mixins,

        _addLineHandler : function () {
            dispatcher.dispatch({
                actionType: 'LINE_ADDED',
                props: {
                    negated: false,
                    structureName: Object.keys(this.props.structsAndAttrs)[0],
                    attributeCql: ''
                }
            });
        },

        getInitialState : function () {
            return {updated: new Date()};
        },

        changeHandler : function (data) {
            this.setState({updated: new Date()});
        },

        componentDidMount : function () {
            subcorpFormStore.addChangeListener(this.changeHandler);
        },

        componentWillUnmount : function () {
            subcorpFormStore.removeChangeListener(this.changeHandler);
        },

        _renderStructLine : function (line, viewIdx) {
            return [
                <WithinLine key ={'wl' + line.rowIdx} rowIdx={line.rowIdx} viewIdx={viewIdx}
                    lineData={line} structsAndAttrs={this.props.structsAndAttrs} />,
                <StructLine key={'sl' + line.rowIdx} rowIdx={line.rowIdx} viewIdx={viewIdx}
                    lineData={line} structsAndAttrs={this.props.structsAndAttrs} />
            ];
        },

        render : function () {
            let lines = subcorpFormStore.getLines();
            return (
                <table>
                    <tbody>
                        {lines.filter(line=>!!line).map((line, i) => this._renderStructLine(line, i))}
                        <tr key="button-row" className="last-line">
                            <td>
                                <a className="add-within"
                                    onClick={this._addLineHandler}
                                    title={this.translate('global__add_within')}>+</a>
                            </td>
                            <td></td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>
            );
        }
    });

    return {
        WithinBuilder: WithinBuilder
    };
}