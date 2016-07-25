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

/// <reference path="../../../ts/declarations/react.d.ts" />

import React from 'vendor/react';


export function init(dispatcher, mixins, viewOptionsStore) {

    // ---------------------------- <LiAttributeItem /> ----------------------

    let LiAttributeItem = React.createClass({

        _handleClick : function () {
            dispatcher.dispatch({
                actionType: 'VIEW_OPTIONS_SET_ATTRIBUTE',
                props: {
                    idx: this.props.idx,
                    ident: this.props.n
                }
            });
        },

        render : function () {
            return (
                <li>
                    <label>
                        <input type="checkbox" name="setattrs" value={this.props.n}
                                checked={this.props.isSelected ? true : false}
                                onChange={this._handleClick} />
                        {this.props.label}
                    </label>
                </li>
            );
        }
    });

    // ---------------------------- <FixedAttributeItem /> ----------------------

    let LiFixedAttributeItem = React.createClass({
        render : function () {
            return (
                <li>
                    <input type="hidden" name="setattrs" value={this.props.n} />
                    <label>
                        <input type="checkbox" value={this.props.n} disabled checked />
                        {this.props.label}
                    </label>
                </li>
            );
        }
    });

    // ---------------------------- <SelectAll /> ----------------------

    let SelectAll = React.createClass({

        mixins: mixins,

        render : function () {
            return (
                <label className="select-all">
                    <input className="select-all" type="checkbox" />
                    {this.translate('global__select_all')}
                </label>
            );
        }
    });

    // ---------------------------- <FieldsetAttributes /> ----------------------

    let FieldsetAttributes = React.createClass({

        mixins : mixins,

        render : function () {
            return (
                <fieldset className="settings-group">
                    <legend>{this.translate('options__attributes_hd')}</legend>
                    <ul>
                    {this.props.attrList.map((item, i) => {
                        if (item.locked) {
                            return <LiFixedAttributeItem key={'atrr:' + item.n} n={item.n} label={item.label} />;

                        } else {
                            return <LiAttributeItem key={'atrr:' + item.n} idx={i} n={item.n} label={item.label}
                                            isSelected={item.selected} />;
                        }
                    })}
                    </ul>
                    <SelectAll />
                </fieldset>
            );
        }
    });

    // ---------------------------- <StructAttrList /> ----------------------

    let StructAttrList = React.createClass({

        render : function () {
            return (
                <ul>
                    {this.props.items.map((item, i) => {
                        return (
                            <li key={i}>
                                <label>
                                    <input type="checkbox" name="structattrs" value={item.n}
                                        checked={item.selected} onChange={this.props.handleClick} />
                                    {item.n}
                                </label>
                            </li>
                        );
                    })}
                </ul>
            );
        }
    });

    // ---------------------------- <FieldsetStructures /> ----------------------

    let FieldsetStructures = React.createClass({

        mixins : mixins,

        _handleStructClick : function (event) {
            dispatcher.dispatch({
                actionType: 'VIEW_OPTIONS_SET_STRUCTURE',
                props: {
                    structIdent: event.target.value,
                    structAttrIdent: null
                }
            });
        },

        _handleStructAttrClick : function (structIdent, event) {
            dispatcher.dispatch({
                actionType: 'VIEW_OPTIONS_SET_STRUCTURE',
                props: {
                    structIdent: structIdent,
                    structAttrIdent: event.target.value
                }
            });
        },

        render : function () {
            return (
                <fieldset className="settings-group">
                    <legend>{this.translate('options__structures_hd')}</legend>
                    <ul>
                        {this.props.availStructs.map((item) => {
                            return (
                                <li key={item.n}>
                                    <label className="struct">
                                        <input type="checkbox" name="setstructs" value={item.n}
                                                checked={item.selected} onChange={this._handleStructClick} />
                                        {'<' + item.n + '>'}
                                    </label>
                                    <StructAttrList items={this.props.structAttrs.get(item.n)}
                                            handleClick={this._handleStructAttrClick.bind(this, item.n)} />
                                </li>
                            );
                        })}
                    </ul>
                </fieldset>
            );
        }
    });


    // ---------------------------- <FieldsetMetainformation /> ----------------------


    let FieldsetMetainformation = React.createClass({

        mixins : mixins,

        render : function () {
            return (
                <fieldset className="settings-group">
                    <legend>{this.translate('options__references_hd')}</legend>
                </fieldset>
            );
        }
    });


    // ---------------------------- <StructsAndAttrsForm /> ----------------------


    let StructsAndAttrsForm = React.createClass({

        mixins : mixins,

        _fetchData : function () {
            return {
                fixedAttr: viewOptionsStore.getFixedAttr(),
                attrList: viewOptionsStore.getAttributes(),
                availStructs: viewOptionsStore.getStructures(),
                structAttrs: viewOptionsStore.getStructAttrs()
            };
        },

        _storeChangeHandler : function (store, action) {
            this.setState(this._fetchData());
        },

        componentDidMount : function () {
            viewOptionsStore.addChangeListener(this._storeChangeHandler);
        },

        componentWillUnmount : function () {
            viewOptionsStore.removeChangeListener(this._storeChangeHandler);
        },

        getInitialState : function () {
            return this._fetchData();
        },

        render : function () {
            return (
                <form id="mainform" action={this.createActionLink('options/viewattrsx')}>
                    <FieldsetAttributes fixedAttr={this.state.fixedAttr} attrList={this.state.attrList} />
                    <FieldsetStructures availStructs={this.state.availStructs} structAttrs={this.state.structAttrs} />
                    <FieldsetMetainformation />
                </form>
            );
        }

    });


    return {
        StructsAndAttrsForm: StructsAndAttrsForm
    };

}