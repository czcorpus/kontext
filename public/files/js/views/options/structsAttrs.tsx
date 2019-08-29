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
import {IActionDispatcher, BoundWithProps} from 'kombo';
import {Kontext, ViewOptions} from '../../types/common';
import { CorpusViewOptionsModel, CorpusViewOptionsModelState } from '../../models/options/structsAttrs';

export interface StructsAttrsModuleArgs {
    dispatcher:IActionDispatcher;
    helpers:Kontext.ComponentHelpers;
    viewOptionsModel:CorpusViewOptionsModel;
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
                name: 'VIEW_OPTIONS_TOGGLE_ATTRIBUTE',
                payload: {
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
        attrsVmode:ViewOptions.AttrViewMode;
        showConcToolbar:boolean;

    }> = (props) => {

        const handleSelectChangeFn = (event:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch({
                name: 'VIEW_OPTIONS_UPDATE_ATTR_VISIBILITY',
                payload: {
                    value: event.target.value
                }
            });
        };

        return (
            <div className="AttributesTweaks">
                <h3 className="label">
                    {helpers.translate('options__attr_apply_header')}
                </h3>
                <ul>
                    <li>
                        <label>
                            <input type="radio" value={ViewOptions.AttrViewMode.VISIBLE_ALL}
                                    checked={props.attrsVmode === ViewOptions.AttrViewMode.VISIBLE_ALL}
                                    onChange={handleSelectChangeFn} />
                            <span>{helpers.translate('options__vmode_switch_visible_all')}</span>
                        </label>
                    </li>
                    <li>
                        <label>
                            <input type="radio" value={ViewOptions.AttrViewMode.VISIBLE_KWIC}
                                    checked={props.attrsVmode === ViewOptions.AttrViewMode.VISIBLE_KWIC}
                                    onChange={handleSelectChangeFn} />
                            <span>{helpers.translate('options__vmode_switch_mixed')}</span>
                        </label>
                    </li>
                    <li>
                        <label>
                            <input type="radio" value={ViewOptions.AttrViewMode.MOUSEOVER}
                                    checked={props.attrsVmode === ViewOptions.AttrViewMode.MOUSEOVER}
                                    onChange={handleSelectChangeFn} />
                            <span>{helpers.translate('options__vmode_switch_mouseover_all')}</span>
                        </label>
                    </li>
                </ul>
            </div>
        );
    };

    // ---------------------------- <FieldsetAttributes /> ----------------------

    const FieldsetAttributes:React.SFC<{
        attrList:Immutable.List<ViewOptions.AttrDesc>;
        hasSelectAll:boolean;
        attrsVmode:ViewOptions.AttrViewMode;
        showConcToolbar:boolean;
        lockedPosAttrNotSelected:boolean;

    }> = (props) => {

        const handleSelectAll = () => {
            dispatcher.dispatch({
                name: 'VIEW_OPTIONS_TOGGLE_ALL_ATTRIBUTES',
                payload: {}
            });
        };

        return (
            <fieldset className="FieldsetAttributes">
                <ul>
                {props.attrList.map((item, i) => {
                    return <LiAttributeItem key={'atrr:' + item.n} idx={i} n={item.n} label={item.label}
                                        isSelected={item.selected} />;
                })}
                </ul>
                <SelectAll onChange={handleSelectAll} isSelected={props.hasSelectAll} />
                {props.lockedPosAttrNotSelected ?
                    <p className="warning">
                        <img className="icon"
                                src={helpers.createStaticUrl('img/warning-icon.svg')}
                                alt={helpers.translate('global__warning_icon')} />
                        {helpers.translate('options__remove_word_warning')}
                    </p> :
                    null
                }
                <hr />
                <AttributesTweaks attrsVmode={props.attrsVmode}
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
        corpusUsesRTLText:boolean;
        hasSelectAll:boolean;
    }> = (props) => {

        const handleStructClick = (event) => {
            dispatcher.dispatch({
                name: 'VIEW_OPTIONS_TOGGLE_STRUCTURE',
                payload: {
                    structIdent: event.target.value,
                    structAttrIdent: null
                }
            });
        };

        const handleStructAttrClickFn = (structIdent) => {
            return (attrIdent) => {
                dispatcher.dispatch({
                    name: 'VIEW_OPTIONS_TOGGLE_STRUCTURE',
                    payload: {
                        structIdent: structIdent,
                        structAttrIdent: attrIdent
                    }
                });
            };
        };

        const handleSelectAll = (evt) => {
            dispatcher.dispatch({
                name: 'VIEW_OPTIONS_TOGGLE_ALL_STRUCTURES',
                payload: {}
            });
        };

        return (
            <fieldset className="FieldsetStructures">
                {props.corpusUsesRTLText ?
                    <p className="warning">
                        <img className="icon"
                                src={helpers.createStaticUrl('img/warning-icon.svg')}
                                alt={helpers.translate('global__warning_icon')} />
                        {helpers.translate('options__rtl_text_warning')}
                    </p> :
                    null}
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
                <SelectAll onChange={handleSelectAll} isSelected={props.hasSelectAll} />
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
                    name: 'VIEW_OPTIONS_TOGGLE_REFERENCE',
                    payload: {
                        idx: idx
                    }
                });
            };
        };

        const handleSelectAll = (evt) => {
            dispatcher.dispatch({
                name: 'VIEW_OPTIONS_TOGGLE_ALL_REFERENCES',
                payload: {}
            });
        };

        return (
            <fieldset className="FieldsetMetainformation">
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
                name: 'VIEW_OPTIONS_SAVE_SETTINGS',
                payload: {}
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
        showConcToolbar:boolean;
        attrsVmode:ViewOptions.AttrViewMode;
        structAttrs:ViewOptions.AvailStructAttrs;
        hasSelectAllStruct:boolean;
        availRefs:Immutable.List<ViewOptions.RefsDesc>;
        TehasSelectAllRefs:boolean;
        isWaiting:boolean;
        userIsAnonymous:boolean;
        lockedPosAttrNotSelected:boolean;
        corpusUsesRTLText:boolean;

    }> = (props) => {
        const [state, setState] = React.useState('attributes');

        const items = Immutable.List([
            {id: 'attributes', label: helpers.translate('options__attributes_hd')},
            {id: 'structures', label: helpers.translate('options__structures_hd')},
            {id: 'metainformation', label: helpers.translate('options__references_hd')},
        ])

        if (props.hasLoadedData) {
            return (
                <form method="POST" className="StructsAndAttrsForm" action={helpers.createActionLink('options/viewattrsx')}>
                    <div>
                        <layoutViews.TabMenu
                            className="FieldsetsTabs"
                            callback={setState}
                            items={items} />

                        <span style={state!=='attributes' ? {display: 'none'} : null}>
                            <FieldsetAttributes
                                attrList={props.attrList}
                                hasSelectAll={props.hasSelectAllAttrs}
                                attrsVmode={props.attrsVmode}
                                showConcToolbar={props.showConcToolbar}
                                lockedPosAttrNotSelected={props.lockedPosAttrNotSelected} />
                        </span>

                        <span style={state!=='structures' ? {display: 'none'} : null}>
                            <FieldsetStructures
                                availStructs={props.availStructs}
                                structAttrs={props.structAttrs}
                                hasSelectAll={props.hasSelectAllStruct}
                                corpusUsesRTLText={props.corpusUsesRTLText} />
                        </span>

                        <span style={state!=='metainformation' ? {display: 'none'} : null}>
                            <FieldsetMetainformation
                                availRefs={props.availRefs}
                                hasSelectAll={props.TehasSelectAllRefs} />
                        </span>

                        {props.userIsAnonymous ?
                            <p className="warn">
                                <layoutViews.StatusIcon status="warning" htmlClass="icon" inline={true} />
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

    const StructAttrsViewOptions:React.SFC<StructAttrsViewOptionsProps & CorpusViewOptionsModelState> = (props) => {

        return (
            <div className="StructAttrsViewOptions">
                <StructsAndAttrsForm
                        fixedAttr={props.fixedAttr}
                        attrList={props.attrList}
                        availStructs={props.structList}
                        structAttrs={props.structAttrs}
                        hasSelectAllStruct={props.selectAllStruct}
                        availRefs={props.referenceList}
                        hasSelectAllAttrs={props.selectAllAttrs}
                        TehasSelectAllRefs={props.selectAllReferences}
                        hasLoadedData={props.hasLoadedData}
                        attrsVmode={props.extendedVmode}
                        showConcToolbar={props.showConcToolbar}
                        isWaiting={props.isBusy}
                        userIsAnonymous={props.userIsAnonymous}
                        lockedPosAttrNotSelected={props.attrList.find(v => v.locked).selected}
                        corpusUsesRTLText={props.corpusUsesRTLText} />
            </div>
        );
    }

    return {
        StructAttrsViewOptions: BoundWithProps(StructAttrsViewOptions, viewOptionsModel)
    };

}