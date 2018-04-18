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

import * as React from 'react';
import * as Immutable from 'immutable';
import {ActionDispatcher} from '../../app/dispatcher';
import {Kontext, ViewOptions} from '../../types/common';

export interface StructsAttrsModuleArgs {
    dispatcher:ActionDispatcher;
    helpers:Kontext.ComponentHelpers;
    viewOptionsModel:ViewOptions.ICorpViewOptionsModel;
    mainMenuModel:Kontext.IMainMenuModel;
}

export interface StructAttrsViewOptionsProps {

}

export interface StructsAttrsViews {
    StructAttrsViewOptions:React.ComponentClass<StructAttrsViewOptionsProps>;
}


export function init({dispatcher, helpers, viewOptionsModel,
            mainMenuModel}:StructsAttrsModuleArgs):StructsAttrsViews {

    const layoutViews = helpers.getLayoutViews();

    // ---------------------------- <LiAttributeItem /> ----------------------

    const LiAttributeItem:React.SFC<{
        idx:number;
        label:string;
        n:string;
        isSelected:boolean;

    }> = (props) => {

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

    const LiFixedAttributeItem:React.SFC<{
        n:string;
        label:string;

    }> = (props) => {

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

    const SelectAll:React.SFC<{
        isSelected:boolean;
        onChange:(evt:React.ChangeEvent<{}>)=>void;

    }> = (props) => {

        return (
            <label className="select-all">
                <input className="select-all" type="checkbox"
                        onChange={props.onChange} checked={props.isSelected} />
                {helpers.translate('global__select_all')}
            </label>
        );
    };

    // ---------------------------- <AttributesTweaks /> ----------------------

    const AttributesTweaks:React.SFC<{
        attrsVmode:string; // TODO enum
        showConcToolbar:boolean;
        attrsAllpos:string;

    }> = (props) => {

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

    const FieldsetAttributes:React.SFC<{
        attrList:Immutable.List<ViewOptions.AttrDesc>;
        hasSelectAll:boolean;
        attrsVmode:string;
        attrsAllpos:string;
        showConcToolbar:boolean;

    }> = (props) => {

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

    const StructAttrList:React.SFC<{
        struct:string;
        items:Immutable.List<ViewOptions.StructAttrDesc>;
        handleClick:(v:string)=>void;

    }> = (props) => {

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

    const FieldsetStructures:React.SFC<{
        availStructs:Immutable.List<ViewOptions.AttrDesc>;
        structAttrs:ViewOptions.AvailStructAttrs;

    }> = (props) => {

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
                                        items={props.structAttrs.get(item.n) || Immutable.List()}
                                        handleClick={handleStructAttrClickFn(item.n)} />
                            </li>
                        );
                    })}
                </ul>
            </fieldset>
        );
    };


    // ---------------------------- <LiReferenceItem /> ----------------------

    const LiReferenceItem:React.SFC<{
        n:string;
        label:string;
        isSelected:boolean;
        onChange:(evt:React.ChangeEvent<{}>)=>void;

    }> = (props) => {
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

    const FieldsetMetainformation:React.SFC<{
        availRefs:Immutable.List<ViewOptions.RefsDesc>;
        hasSelectAll:boolean;

    }> = (props) => {

        const handleCheckboxChangeFn = (idx) => {
            return (evt:React.ChangeEvent<{}>) => {
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

    const SubmitButtons:React.SFC<{
        isWaiting:boolean;

    }> = (props) => {

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

    const StructsAndAttrsForm:React.SFC<{
        hasLoadedData:boolean;
        fixedAttr:string;
        attrList:Immutable.List<ViewOptions.AttrDesc>;
        availStructs: Immutable.List<ViewOptions.StructDesc>;
        hasSelectAllAttrs:boolean;
        attrsAllpos:string;
        showConcToolbar:boolean;
        attrsVmode:string;
        structAttrs:ViewOptions.AvailStructAttrs;
        availRefs:Immutable.List<ViewOptions.RefsDesc>;
        TehasSelectAllRefs:boolean;
        isWaiting:boolean;
        userIsAnonymous:boolean;

    }> = (props) => {

        if (props.hasLoadedData) {
            return (
                <form method="POST" className="StructsAndAttrsForm" action={helpers.createActionLink('options/viewattrsx')}>
                    <div>
                        <FieldsetAttributes  attrList={props.attrList}
                                hasSelectAll={props.hasSelectAllAttrs} attrsAllpos={props.attrsAllpos}
                                attrsVmode={props.attrsVmode} showConcToolbar={props.showConcToolbar} />
                        <FieldsetStructures availStructs={props.availStructs} structAttrs={props.structAttrs} />
                        <FieldsetMetainformation availRefs={props.availRefs}
                                hasSelectAll={props.TehasSelectAllRefs} />
                        {props.userIsAnonymous ?
                            <p className="warn">
                                <layoutViews.StatusIcon status="warning" htmlClass="icon" />
                                {helpers.translate('global__anon_user_opts_save_warn')}
                            </p> :
                            null
                        }
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

    class StructAttrsViewOptions extends React.Component<StructAttrsViewOptionsProps, {
        corpusIdent:Kontext.FullCorpusIdent;
        fixedAttr:string;
        attrList:Immutable.List<ViewOptions.AttrDesc>;
        availStructs:Immutable.List<ViewOptions.StructDesc>;
        structAttrs:ViewOptions.AvailStructAttrs;
        availRefs:Immutable.List<ViewOptions.RefsDesc>;
        hasSelectAllAttrs:boolean;
        TehasSelectAllRefs:boolean;
        hasLoadedData:boolean;
        attrsVmode:string;
        attrsAllpos:string;
        showConcToolbar:boolean;
        isWaiting:boolean;
        isVisible:boolean;
        userIsAnonymous:boolean;
    }> {

        // states: 0 - invisible, 1 - visible-pending,  2 - visible-waiting_to_close

        constructor(props) {
            super(props);
            this._handleModelChange = this._handleModelChange.bind(this);
            this._handleViewOptsModelChange = this._handleViewOptsModelChange.bind(this);
            this.state = this._fetchModelState();
        }

        _fetchModelState() {
            return {
                corpusIdent: viewOptionsModel.getCorpusIdent(),
                fixedAttr: viewOptionsModel.getFixedAttr(),
                attrList: viewOptionsModel.getAttributes(),
                availStructs: viewOptionsModel.getStructures(),
                structAttrs: viewOptionsModel.getStructAttrs(),
                availRefs: viewOptionsModel.getReferences(),
                hasSelectAllAttrs: viewOptionsModel.getSelectAllAttributes(),
                TehasSelectAllRefs: viewOptionsModel.getSelectAllReferences(),
                hasLoadedData: viewOptionsModel.isLoaded(),
                attrsVmode: viewOptionsModel.getAttrsVmode(),
                attrsAllpos: viewOptionsModel.getAttrsAllpos(),
                showConcToolbar: viewOptionsModel.getShowConcToolbar(),
                isWaiting: viewOptionsModel.getIsWaiting(),
                isVisible: false,
                userIsAnonymous: viewOptionsModel.getUserIsAnonymous()
            };
        }

        _handleModelChange() {
            const activeItem = mainMenuModel.getActiveItem();
            if (activeItem &&
                    activeItem.actionName === 'MAIN_MENU_SHOW_ATTRS_VIEW_OPTIONS') {
                const state = this._fetchModelState();
                state.isVisible = true;
                this.setState(state);
            }
        }

        _handleViewOptsModelChange() {
            const state = this._fetchModelState();
            if (this.state.isWaiting && !state.isWaiting) {
                state.isVisible = false;

            } else {
                state.isVisible = this.state.isVisible;
            }
            this.setState(state);
        }

        componentDidMount() {
            mainMenuModel.addChangeListener(this._handleModelChange);
            viewOptionsModel.addChangeListener(this._handleViewOptsModelChange);
            // ---> not needed (see action prerequisite)
            if (this.state.isVisible) {
                dispatcher.dispatch({
                    actionType: 'VIEW_OPTIONS_LOAD_DATA',
                    props: {}
                });
            }
        }

        componentWillUnmount() {
            mainMenuModel.removeChangeListener(this._handleModelChange);
            viewOptionsModel.removeChangeListener(this._handleViewOptsModelChange);
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
                            TehasSelectAllRefs={this.state.TehasSelectAllRefs}
                            hasLoadedData={this.state.hasLoadedData}
                            attrsVmode={this.state.attrsVmode}
                            attrsAllpos={this.state.attrsAllpos}
                            showConcToolbar={this.state.showConcToolbar}
                            isWaiting={this.state.isWaiting}
                            userIsAnonymous={this.state.userIsAnonymous} />
                </div>
            );
        }
    }

    return {
        StructAttrsViewOptions: StructAttrsViewOptions
    };

}