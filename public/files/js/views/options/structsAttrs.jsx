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
                actionType: 'VIEW_OPTIONS_TOGGLE_ATTRIBUTE',
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
                    <input className="select-all" type="checkbox"
                            onChange={this.props.onChange} checked={this.props.isSelected} />
                    {this.translate('global__select_all')}
                </label>
            );
        }
    });

    // ---------------------------- <AttributesTweaks /> ----------------------

    let AttributesTweaks = React.createClass({

        mixins : mixins,

        _handleSelectChange : function (name, event) {
            dispatcher.dispatch({
                actionType: 'VIEW_OPTIONS_UPDATE_ATTR_VISIBILITY',
                props: {
                    name: name,
                    value: event.target.value
                }
            });
        },

        render : function () {
            return (
                <div>
                    <select name="allpos"
                            value={this.props.attrsAllpos}
                            className="no-label"
                            onChange={this._handleSelectChange.bind(this, 'allpos')}
                            disabled={this.props.attrsVmode === 'mouseover'}
                            title={this.props.attrsVmode === 'mouseover' ?
                                    this.translate('options__locked_allpos_expl') : null}>
                        <option value="all">{this.translate('options__attr_apply_all')}</option>
                        <option value="kw">{this.translate('options__attr_apply_kwic')}</option>
                    </select>
                    {this.props.attrsVmode === 'mouseover' ?
                        <input type="hidden" name="allpos" value="all" /> : null}
                    <select name="attr_vmode"
                            value={this.props.attrsVmode}
                            onChange={this._handleSelectChange.bind(this, 'attr_vmode')}
                            className="no-label">
                        <option value="visible">Display attributes directly in text</option>
                        <option value="mouseover">Make attributes available on mouse-over</option>
                    </select>
                </div>
            );
        }
    });

    // ---------------------------- <FieldsetAttributes /> ----------------------

    let FieldsetAttributes = React.createClass({

        mixins : mixins,

        _handleSelectAll : function () {
            dispatcher.dispatch({
                actionType: 'VIEW_OPTIONS_TOGGLE_ALL_ATTRIBUTES',
                props: {}
            });
        },

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
                    <SelectAll onChange={this._handleSelectAll} isSelected={this.props.hasSelectAll} />
                    <hr />
                    <AttributesTweaks attrsVmode={this.props.attrsVmode} attrsAllpos={this.props.attrsAllpos} />
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
                actionType: 'VIEW_OPTIONS_TOGGLE_STRUCTURE',
                props: {
                    structIdent: event.target.value,
                    structAttrIdent: null
                }
            });
        },

        _handleStructAttrClick : function (structIdent, event) {
            dispatcher.dispatch({
                actionType: 'VIEW_OPTIONS_TOGGLE_STRUCTURE',
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
                                    <StructAttrList items={this.props.structAttrs.get(item.n) || []}
                                            handleClick={this._handleStructAttrClick.bind(this, item.n)} />
                                </li>
                            );
                        })}
                    </ul>
                </fieldset>
            );
        }
    });


    // ---------------------------- <LiReferenceItem /> ----------------------


    let LiReferenceItem = React.createClass({
        render : function () {
            return (
                <li>
                    <label>
                        <input type="checkbox" name="setrefs" value={this.props.n}
                                checked={this.props.isSelected} onChange={this.props.onChange} />
                        {this.props.label}
                    </label>
                </li>
            );
        }
    });


    // ---------------------------- <FieldsetMetainformation /> ----------------------


    let FieldsetMetainformation = React.createClass({

        mixins : mixins,

        _handleCheckboxChange : function (idx, evt) {
            dispatcher.dispatch({
                actionType: 'VIEW_OPTIONS_TOGGLE_REFERENCE',
                props: {
                    idx: idx
                }
            });
        },

        _handleSelectAll : function (evt) {
            dispatcher.dispatch({
                actionType: 'VIEW_OPTIONS_TOGGLE_ALL_REFERENCES',
                props: {}
            });
        },

        render : function () {
            return (
                <fieldset className="settings-group">
                    <legend>{this.translate('options__references_hd')}</legend>
                    <ul>
                        {this.props.availRefs.map((item, i) => {
                            return <LiReferenceItem
                                        key={item.n}
                                        idx={i}
                                        n={item.n}
                                        label={item.label}
                                        isSelected={item.selected}
                                        onChange={this._handleCheckboxChange.bind(this, i)} />;
                        })}
                    </ul>
                    <SelectAll onChange={this._handleSelectAll} isSelected={this.props.hasSelectAll} />
                </fieldset>
            );
        }
    });


    // ---------------------------- <SubmitButtons /> ----------------------


    let SubmitButtons = React.createClass({
        mixins : mixins,

        _handleSaveClick : function () {
            dispatcher.dispatch({
                actionType: 'VIEW_OPTIONS_SAVE_SETTINGS',
                props: {}
            });
        },

        _renderButtonVariant : function () {
            if (this.props.isSubmitMode) {
                return (
                    <button type="submit" className="default-button">
                        {this.translate('options__apply_btn')}
                    </button>
                );

            } else {
                return [
                    <button key="save" type="button" className="default-button"
                            onClick={this._handleSaveClick}>
                        {this.translate('options__apply_btn')}
                    </button>,
                    <button key="cancel" type="button" className="default-button" onClick={this.props.externalCloseCallback}>
                        {this.translate('global__close')}
                    </button>
                ]
            }
        },

        render : function () {
            return (
                <div className="buttons">
                    {this._renderButtonVariant()}
                </div>
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
                structAttrs: viewOptionsStore.getStructAttrs(),
                availRefs: viewOptionsStore.getReferences(),
                hasSelectAllAttrs: viewOptionsStore.getSelectAllAttributes(),
                hasSellectAllRefs: viewOptionsStore.getSelectAllReferences(),
                hasLoadedData: viewOptionsStore.isLoaded(),
                attrsVmode: viewOptionsStore.getAttrsVmode(),
                attrsAllpos: viewOptionsStore.getAttrsAllpos()
            };
        },

        _storeChangeHandler : function (store, action) {
            this.setState(this._fetchData());
        },

        componentDidMount : function () {
            if (!this.props.isSubmitMode) {
                dispatcher.dispatch({
                    actionType: 'VIEW_OPTIONS_LOAD_DATA',
                    props: {}
                });
            }
            viewOptionsStore.addChangeListener(this._storeChangeHandler);
        },

        componentWillUnmount : function () {
            viewOptionsStore.removeChangeListener(this._storeChangeHandler);
        },

        getInitialState : function () {
            return this._fetchData();
        },

        _renderStateInputs : function () {
            // <input type="hidden" name="fromp" value="TODO__" />;
            return (this.props.stateArgs || []).map(item => {
                return <input key={item[0]} type="hidden" name={item[0]} value={item[1]} />;
            });
        },

        render : function () {
            if (this.props.isSubmitMode || this.state.hasLoadedData) {
                return (
                    <form id="mainform" method="POST" action={this.createActionLink('options/viewattrsx')}>
                        <p>
                            {this.translate('options__settings_apply_only_for_{corpname}', {corpname: this.props.humanCorpname})}
                        </p>
                        {this.props.isSubmitMode ? this._renderStateInputs() : null}
                        <FieldsetAttributes fixedAttr={this.state.fixedAttr} attrList={this.state.attrList}
                                hasSelectAll={this.state.hasSelectAllAttrs} attrsAllpos={this.state.attrsAllpos}
                                attrsVmode={this.state.attrsVmode} />
                        <FieldsetStructures availStructs={this.state.availStructs} structAttrs={this.state.structAttrs} />
                        <FieldsetMetainformation availRefs={this.state.availRefs}
                                hasSelectAll={this.state.hasSellectAllRefs} />
                        <SubmitButtons externalCloseCallback={this.props.externalCloseCallback}
                                isSubmitMode={this.props.isSubmitMode} />
                    </form>
                );

            } else {
                return (
                    <div>
                        <img src={this.createStaticUrl('img/ajax-loader.gif')}
                            alt={this.translate('global__loading')} title={this.translate('global__loading')} />
                    </div>
                );
            }
        }

    });


    return {
        StructsAndAttrsForm: StructsAndAttrsForm
    };

}