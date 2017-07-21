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

import * as React from 'vendor/react';


export function init(dispatcher, helpers, layoutViews, viewOptionsStore, mainMenuStore) {

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

        render : function () {
            return (
                <label className="select-all">
                    <input className="select-all" type="checkbox"
                            onChange={this.props.onChange} checked={this.props.isSelected} />
                    {helpers.translate('global__select_all')}
                </label>
            );
        }
    });

    // ---------------------------- <AttributesTweaks /> ----------------------

    let AttributesTweaks = React.createClass({

        _handleSelectChange : function (name, event) {
            dispatcher.dispatch({
                actionType: 'VIEW_OPTIONS_UPDATE_ATTR_VISIBILITY',
                props: {
                    name: name,
                    value: event.target.value
                }
            });
        },

        _renderVmodeInfoIcon : function () {
            let src;
            let title;
            if (this.props.attrsVmode === 'mouseover') {
                src = helpers.createStaticUrl('img/mouseover-available.svg')
                title = helpers.translate('options__vmode_switch_indicator_desc');

            } else {
                src = helpers.createStaticUrl('img/mouseover-not-available.svg');
                title = helpers.translate('options__vmode_switch_indicator_desc');
            }
            return <img className="vmode-indicator" src={src} alt={title} title={title} />;
        },

        render : function () {
            return (
                <div>
                    <h3 className="label">
                        {helpers.translate('options__attr_apply_header')}
                    </h3>
                    <div>
                        <select name="attr_vmode"
                                value={this.props.attrsVmode}
                                onChange={this._handleSelectChange.bind(this, 'attr_vmode')}
                                className="no-label">
                            <option value="visible">{helpers.translate('options__vmode_switch_visible')}</option>
                            <option value="mouseover">{helpers.translate('options__vmode_switch_mouseover')}</option>
                        </select>
                        {this.props.showConcToolbar ? this._renderVmodeInfoIcon() : null}
                    </div>
                    <div>
                        <select name="allpos"
                                value={this.props.attrsAllpos}
                                className="no-label"
                                onChange={this._handleSelectChange.bind(this, 'allpos')}
                                disabled={this.props.attrsVmode === 'mouseover'}
                                title={this.props.attrsVmode === 'mouseover' ?
                                        helpers.translate('options__locked_allpos_expl') : null}>
                            <option value="all">{helpers.translate('options__attr_apply_all')}</option>
                            <option value="kw">{helpers.translate('options__attr_apply_kwic')}</option>
                        </select>
                        {this.props.attrsVmode === 'mouseover' ?
                            <input type="hidden" name="allpos" value="all" /> : null}
                    </div>
                </div>
            );
        }
    });

    // ---------------------------- <FieldsetAttributes /> ----------------------

    let FieldsetAttributes = React.createClass({

        _handleSelectAll : function () {
            dispatcher.dispatch({
                actionType: 'VIEW_OPTIONS_TOGGLE_ALL_ATTRIBUTES',
                props: {}
            });
        },

        render : function () {
            return (
                <fieldset className="settings-group">
                    <legend>{helpers.translate('options__attributes_hd')}</legend>
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
                    <AttributesTweaks attrsVmode={this.props.attrsVmode} attrsAllpos={this.props.attrsAllpos}
                            showConcToolbar={this.props.showConcToolbar} />
                </fieldset>
            );
        }
    });

    // ---------------------------- <StructAttrList /> ----------------------

    let StructAttrList = React.createClass({

        _checkboxHandler : function (value) {
            this.props.handleClick(value);
        },

        render : function () {
            return (
                <ul>
                    {this.props.items.map((item, i) => {
                        return (
                            <li key={i}>
                                <label>
                                    <input type="checkbox" name="structattrs" value={`${this.props.struct}.${item.n}`}
                                        checked={item.selected} onChange={this._checkboxHandler.bind(this, item.n)} />
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

        _handleStructClick : function (event) {
            dispatcher.dispatch({
                actionType: 'VIEW_OPTIONS_TOGGLE_STRUCTURE',
                props: {
                    structIdent: event.target.value,
                    structAttrIdent: null
                }
            });
        },

        _handleStructAttrClick : function (structIdent, attrIdent) {
            dispatcher.dispatch({
                actionType: 'VIEW_OPTIONS_TOGGLE_STRUCTURE',
                props: {
                    structIdent: structIdent,
                    structAttrIdent: attrIdent
                }
            });
        },

        render : function () {
            return (
                <fieldset className="settings-group">
                    <legend>{helpers.translate('options__structures_hd')}</legend>
                    <ul>
                        {this.props.availStructs.map((item) => {
                            return (
                                <li key={item.n}>
                                    <label className="struct">
                                        <input type="checkbox" name="setstructs" value={item.n}
                                                checked={item.selected} onChange={this._handleStructClick} />
                                        {'<' + item.n + '>'}
                                    </label>
                                    <StructAttrList struct={item.n}
                                            items={this.props.structAttrs.get(item.n) || []}
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
                    <legend>{helpers.translate('options__references_hd')}</legend>
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

        _handleSaveClick : function () {
            dispatcher.dispatch({
                actionType: 'VIEW_OPTIONS_SAVE_SETTINGS',
                props: {}
            });
        },

        _renderSubmitButton : function () {
            if (this.props.isWaiting) {
                return <img key="save-waiting" className="ajax-loader"
                                src={helpers.createStaticUrl('img/ajax-loader-bar.gif')}
                                alt={helpers.translate('global__processing')}
                                title={helpers.translate('global__processing')} />

            } else {
                return (
                    <button key="save" type="button" className="default-button"
                            onClick={this._handleSaveClick}>
                        {helpers.translate('options__apply_btn')}
                    </button>
                );
            }
        },

        render : function () {
            return (
                <div className="buttons">
                    {this._renderSubmitButton()}
                </div>
            );
        }
    });


    // ---------------------------- <StructsAndAttrsForm /> ----------------------


    const StructsAndAttrsForm = React.createClass({

        render : function () {
            if (this.props.hasLoadedData) {
                return (
                    <form className="options-form" method="POST" action={helpers.createActionLink('options/viewattrsx')}>
                        <div>
                            <FieldsetAttributes fixedAttr={this.props.fixedAttr} attrList={this.props.attrList}
                                    hasSelectAll={this.props.hasSelectAllAttrs} attrsAllpos={this.props.attrsAllpos}
                                    attrsVmode={this.props.attrsVmode} showConcToolbar={this.props.showConcToolbar} />
                            <FieldsetStructures availStructs={this.props.availStructs} structAttrs={this.props.structAttrs} />
                            <FieldsetMetainformation availRefs={this.props.availRefs}
                                    hasSelectAll={this.props.hasSellectAllRefs} />
                            <SubmitButtons isWaiting={this.props.isWaiting} />
                        </div>
                    </form>
                );

            } else {
                return (
                    <div>
                        <img src={helpers.createStaticUrl('img/ajax-loader.gif')}
                            alt={helpers.translate('global__loading')} title={helpers.translate('global__loading')} />
                    </div>
                );
            }
        }
    });


    // ---------------------------- <StructAttrsViewOptions /> ----------------------

    const StructAttrsViewOptions = React.createClass({

        // states: 0 - invisible, 1 - visible-pending,  2 - visible-waiting_to_close

        _fetchStoreState : function () {
            return {
                corpusIdent: viewOptionsStore.getCorpusIdent(),
                fixedAttr: viewOptionsStore.getFixedAttr(),
                attrList: viewOptionsStore.getAttributes(),
                availStructs: viewOptionsStore.getStructures(),
                structAttrs: viewOptionsStore.getStructAttrs(),
                availRefs: viewOptionsStore.getReferences(),
                hasSelectAllAttrs: viewOptionsStore.getSelectAllAttributes(),
                hasSellectAllRefs: viewOptionsStore.getSelectAllReferences(),
                hasLoadedData: viewOptionsStore.isLoaded(),
                attrsVmode: viewOptionsStore.getAttrsVmode(),
                attrsAllpos: viewOptionsStore.getAttrsAllpos(),
                showConcToolbar: viewOptionsStore.getShowConcToolbar(),
                isWaiting: viewOptionsStore.getIsWaiting(),
                isVisible: false
            };
        },

        _handleStoreChange : function () {
            const activeItem = mainMenuStore.getActiveItem();
            if (activeItem &&
                    activeItem.actionName === 'MAIN_MENU_SHOW_ATTRS_VIEW_OPTIONS') {
                const state = this._fetchStoreState();
                state.isVisible = true;
                this.setState(state);
            }
        },

        _handleViewOptsStoreChange : function () {
            const state = this._fetchStoreState();
            if (this.state.isWaiting && !state.isWaiting) {
                state.isVisible = false;

            } else {
                state.isVisible = this.state.isVisible;
            }
            this.setState(state);
        },

        componentDidMount : function () {
            mainMenuStore.addChangeListener(this._handleStoreChange);
            viewOptionsStore.addChangeListener(this._handleViewOptsStoreChange);
            // ---> not needed (see action prerequisite)
            if (this.state.isVisible) {
                dispatcher.dispatch({
                    actionType: 'VIEW_OPTIONS_LOAD_DATA',
                    props: {}
                });
            }
        },

        componentWillUnmount : function () {
            mainMenuStore.removeChangeListener(this._handleStoreChange);
            viewOptionsStore.removeChangeListener(this._handleViewOptsStoreChange);
        },

        getInitialState : function () {
            return this._fetchStoreState();
        },

        render : function () {
            return (
                <div>
                    <StructsAndAttrsForm
                            fixedAttr={this.state.fixedAttr}
                            attrList={this.state.attrList}
                            availStructs={this.state.availStructs}
                            structAttrs={this.state.structAttrs}
                            availRefs={this.state.availRefs}
                            hasSelectAllAttrs={this.state.hasSelectAllAttrs}
                            hasSellectAllRefs={this.state.hasSellectAllRefs}
                            hasLoadedData={this.state.hasLoadedData}
                            attrsVmode={this.state.attrsVmode}
                            attrsAllpos={this.state.attrsAllpos}
                            showConcToolbar={this.state.showConcToolbar}
                            isWaiting={this.state.isWaiting} />
                </div>
            );
        }
    });

    return {
        StructAttrsViewOptions: StructAttrsViewOptions
    };

}