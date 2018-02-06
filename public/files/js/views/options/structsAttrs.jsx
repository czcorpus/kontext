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

/// <reference path="../../vendor.d.ts/react.d.ts" />

import * as React from 'vendor/react';


export function init(dispatcher, helpers, viewOptionsStore, mainMenuStore) {

    const layoutViews = helpers.getLayoutViews();

    // ---------------------------- <LiAttributeItem /> ----------------------

    const LiAttributeItem = (props) => {

        const handleClick = () => {
            dispatcher.dispatch({
                actionType: 'VIEW_OPTIONS_TOGGLE_ATTRIBUTE',
                props: {
                    idx: props.idx,
                    ident: props.n
                }
            });
        };

        return (
            <li>
                <label>
                    <input type="checkbox" name="setattrs" value={props.n}
                            checked={props.isSelected ? true : false}
                            onChange={handleClick} />
                    {props.label}
                </label>
            </li>
        );
    };

    // ---------------------------- <LiFixedAttributeItem /> ----------------------

    const LiFixedAttributeItem = (props) => {

        return (
            <li>
                <input type="hidden" name="setattrs" value={props.n} />
                <label>
                    <input type="checkbox" value={props.n} disabled checked />
                    {props.label}
                </label>
            </li>
        );
    };

    // ---------------------------- <SelectAll /> ----------------------

    const SelectAll = (props) => {

        return (
            <label className="select-all">
                <input className="select-all" type="checkbox"
                        onChange={props.onChange} checked={props.isSelected} />
                {helpers.translate('global__select_all')}
            </label>
        );
    };

    // ---------------------------- <AttributesTweaks /> ----------------------

    const AttributesTweaks = (props) => {

        const handleSelectChangeFn = (name) => {
            return (event) => {
                dispatcher.dispatch({
                    actionType: 'VIEW_OPTIONS_UPDATE_ATTR_VISIBILITY',
                    props: {
                        name: name,
                        value: event.target.value
                    }
                });
            }
        };

        const renderVmodeInfoIcon = () => {
            let src;
            let title;
            if (props.attrsVmode === 'mouseover') {
                src = helpers.createStaticUrl('img/mouseover-available.svg')
                title = helpers.translate('options__vmode_switch_indicator_desc');

            } else if (props.attrsVmode === 'mixed') {
                src = helpers.createStaticUrl('img/mouseover-mixed.svg')
                title = helpers.translate('options__vmode_switch_indicator_desc');

            } else {
                src = helpers.createStaticUrl('img/mouseover-not-available.svg');
                title = helpers.translate('options__vmode_switch_indicator_desc');
            }
            return <img className="vmode-indicator" src={src} alt={title} title={title} />;
        };

        return (
            <div>
                <h3 className="label">
                    {helpers.translate('options__attr_apply_header')}{'\u2026'}
                </h3>
                <div>
                    <select name="attr_vmode"
                            value={props.attrsVmode}
                            onChange={handleSelectChangeFn('attr_vmode')}
                            className="no-label">
                        <option value="visible">{helpers.translate('options__vmode_switch_visible')}</option>
                        <option value="mouseover">{helpers.translate('options__vmode_switch_mouseover')}</option>
                        <option value="mixed">{helpers.translate('options__vmode_switch_mixed')}</option>
                    </select>
                    {props.showConcToolbar ? renderVmodeInfoIcon() : null}
                </div>
                <div>
                    <select name="allpos"
                            value={props.attrsAllpos}
                            className="no-label"
                            onChange={handleSelectChangeFn('allpos')}
                            disabled={props.attrsVmode === 'mouseover' || props.attrsVmode === 'mixed'}
                            title={props.attrsVmode === 'mouseover' ?
                                    helpers.translate('options__locked_allpos_expl') : null}>
                        <option value="all">{helpers.translate('options__attr_apply_all')}</option>
                        <option value="kw">{helpers.translate('options__attr_apply_kwic')}</option>
                    </select>
                </div>
            </div>
        );
    };

    // ---------------------------- <FieldsetAttributes /> ----------------------

    const FieldsetAttributes = (props) => {

        const handleSelectAll = () => {
            dispatcher.dispatch({
                actionType: 'VIEW_OPTIONS_TOGGLE_ALL_ATTRIBUTES',
                props: {}
            });
        };

        return (
            <fieldset className="FieldsetAttributes">
                <legend>{helpers.translate('options__attributes_hd')}</legend>
                <ul>
                {props.attrList.map((item, i) => {
                    if (item.locked) {
                        return <LiFixedAttributeItem key={'atrr:' + item.n} n={item.n} label={item.label} />;

                    } else {
                        return <LiAttributeItem key={'atrr:' + item.n} idx={i} n={item.n} label={item.label}
                                        isSelected={item.selected} />;
                    }
                })}
                </ul>
                <SelectAll onChange={handleSelectAll} isSelected={props.hasSelectAll} />
                <hr />
                <AttributesTweaks attrsVmode={props.attrsVmode} attrsAllpos={props.attrsAllpos}
                        showConcToolbar={props.showConcToolbar} />
            </fieldset>
        );
    };

    // ---------------------------- <StructAttrList /> ----------------------

    const StructAttrList = (props) => {

        const checkboxHandlerFn = (value) => {
            return () => props.handleClick(value);
        };

        return (
            <ul>
                {props.items.map((item, i) => {
                    return (
                        <li key={i}>
                            <label>
                                <input type="checkbox" name="structattrs" value={`${props.struct}.${item.n}`}
                                    checked={item.selected} onChange={checkboxHandlerFn(item.n)} />
                                {item.n}
                            </label>
                        </li>
                    );
                })}
            </ul>
        );
    };

    // ---------------------------- <FieldsetStructures /> ----------------------

    const FieldsetStructures = (props) => {

        const handleStructClick = (event) => {
            dispatcher.dispatch({
                actionType: 'VIEW_OPTIONS_TOGGLE_STRUCTURE',
                props: {
                    structIdent: event.target.value,
                    structAttrIdent: null
                }
            });
        };

        const handleStructAttrClickFn = (structIdent) => {
            return (attrIdent) => {
                dispatcher.dispatch({
                    actionType: 'VIEW_OPTIONS_TOGGLE_STRUCTURE',
                    props: {
                        structIdent: structIdent,
                        structAttrIdent: attrIdent
                    }
                });
            };
        };

        return (
            <fieldset className="FieldsetStructures">
                <legend>{helpers.translate('options__structures_hd')}</legend>
                <ul>
                    {props.availStructs.map((item) => {
                        return (
                            <li key={item.n}>
                                <label className="struct">
                                    <input type="checkbox" name="setstructs" value={item.n}
                                            checked={item.selected} onChange={handleStructClick} />
                                    {'<' + item.n + '>'}
                                </label>
                                <StructAttrList struct={item.n}
                                        items={props.structAttrs.get(item.n) || []}
                                        handleClick={handleStructAttrClickFn(item.n)} />
                            </li>
                        );
                    })}
                </ul>
            </fieldset>
        );
    };


    // ---------------------------- <LiReferenceItem /> ----------------------

    const LiReferenceItem = (props) => {
        return (
            <li>
                <label>
                    <input type="checkbox" name="setrefs" value={props.n}
                            checked={props.isSelected} onChange={props.onChange} />
                    {props.label}
                </label>
            </li>
        );
    };


    // ---------------------------- <FieldsetMetainformation /> ----------------------

    const FieldsetMetainformation = (props) => {

        const handleCheckboxChangeFn = (idx) => {
            return (evt) => {
                dispatcher.dispatch({
                    actionType: 'VIEW_OPTIONS_TOGGLE_REFERENCE',
                    props: {
                        idx: idx
                    }
                });
            };
        };

        const handleSelectAll = (evt) => {
            dispatcher.dispatch({
                actionType: 'VIEW_OPTIONS_TOGGLE_ALL_REFERENCES',
                props: {}
            });
        };

        return (
            <fieldset className="FieldsetMetainformation">
                <legend>{helpers.translate('options__references_hd')}</legend>
                <ul>
                    {props.availRefs.map((item, i) => {
                        return <LiReferenceItem
                                    key={item.n}
                                    idx={i}
                                    n={item.n}
                                    label={item.label}
                                    isSelected={item.selected}
                                    onChange={handleCheckboxChangeFn(i)} />;
                    })}
                </ul>
                <SelectAll onChange={handleSelectAll} isSelected={props.hasSelectAll} />
            </fieldset>
        );
    };


    // ---------------------------- <SubmitButtons /> ----------------------

    const SubmitButtons = (props) => {

        const handleSaveClick = () => {
            dispatcher.dispatch({
                actionType: 'VIEW_OPTIONS_SAVE_SETTINGS',
                props: {}
            });
        };

        const renderSubmitButton = () => {
            if (props.isWaiting) {
                return <img key="save-waiting" className="ajax-loader"
                                src={helpers.createStaticUrl('img/ajax-loader-bar.gif')}
                                alt={helpers.translate('global__processing')}
                                title={helpers.translate('global__processing')} />

            } else {
                return (
                    <button key="save" type="button" className="default-button"
                            onClick={handleSaveClick}>
                        {helpers.translate('options__apply_btn')}
                    </button>
                );
            }
        };

        return (
            <div className="buttons">
                {renderSubmitButton()}
            </div>
        );
    };


    // ---------------------------- <StructsAndAttrsForm /> ----------------------

    const StructsAndAttrsForm = (props) => {

        if (props.hasLoadedData) {
            return (
                <form method="POST" className="StructsAndAttrsForm" action={helpers.createActionLink('options/viewattrsx')}>
                    <div>
                        <FieldsetAttributes fixedAttr={props.fixedAttr} attrList={props.attrList}
                                hasSelectAll={props.hasSelectAllAttrs} attrsAllpos={props.attrsAllpos}
                                attrsVmode={props.attrsVmode} showConcToolbar={props.showConcToolbar} />
                        <FieldsetStructures availStructs={props.availStructs} structAttrs={props.structAttrs} />
                        <FieldsetMetainformation availRefs={props.availRefs}
                                hasSelectAll={props.hasSellectAllRefs} />
                        <SubmitButtons isWaiting={props.isWaiting} />
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
    };


    // ---------------------------- <StructAttrsViewOptions /> ----------------------

    class StructAttrsViewOptions extends React.Component {

        // states: 0 - invisible, 1 - visible-pending,  2 - visible-waiting_to_close

        constructor(props) {
            super(props);
            this._handleStoreChange = this._handleStoreChange.bind(this);
            this._handleViewOptsStoreChange = this._handleViewOptsStoreChange.bind(this);
            this.state = this._fetchStoreState();
        }

        _fetchStoreState() {
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
        }

        _handleStoreChange() {
            const activeItem = mainMenuStore.getActiveItem();
            if (activeItem &&
                    activeItem.actionName === 'MAIN_MENU_SHOW_ATTRS_VIEW_OPTIONS') {
                const state = this._fetchStoreState();
                state.isVisible = true;
                this.setState(state);
            }
        }

        _handleViewOptsStoreChange() {
            const state = this._fetchStoreState();
            if (this.state.isWaiting && !state.isWaiting) {
                state.isVisible = false;

            } else {
                state.isVisible = this.state.isVisible;
            }
            this.setState(state);
        }

        componentDidMount() {
            mainMenuStore.addChangeListener(this._handleStoreChange);
            viewOptionsStore.addChangeListener(this._handleViewOptsStoreChange);
            // ---> not needed (see action prerequisite)
            if (this.state.isVisible) {
                dispatcher.dispatch({
                    actionType: 'VIEW_OPTIONS_LOAD_DATA',
                    props: {}
                });
            }
        }

        componentWillUnmount() {
            mainMenuStore.removeChangeListener(this._handleStoreChange);
            viewOptionsStore.removeChangeListener(this._handleViewOptsStoreChange);
        }

        render() {
            return (
                <div className="StructAttrsViewOptions">
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
    }

    return {
        StructAttrsViewOptions: StructAttrsViewOptions
    };

}