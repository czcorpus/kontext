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
import { IActionDispatcher, BoundWithProps, IModel } from 'kombo';

import { Kontext, ViewOptions } from '../../types/common';
import { CorpusViewOptionsModel, CorpusViewOptionsModelState } from '../../models/options/structsAttrs';
import { MainMenuModelState } from '../../models/mainMenu';
import { Actions, ActionName } from '../../models/options/actions';
import { Actions as OptionsActions, ActionName as OptionsActionName } from '../../models/options/actions';
import { List, HTTP } from 'cnc-tskit';
import { PluginInterfaces } from '../../types/plugins';

export interface StructsAttrsModuleArgs {
    dispatcher:IActionDispatcher;
    helpers:Kontext.ComponentHelpers;
    viewOptionsModel:CorpusViewOptionsModel;
    mainMenuModel:IModel<MainMenuModelState>;
}

export interface StructAttrsViewOptionsProps {

}

export interface StructsAttrsViews {
    StructAttrsViewOptions:React.ComponentClass<StructAttrsViewOptionsProps>;
}


export function init({dispatcher, helpers, viewOptionsModel,
            mainMenuModel}:StructsAttrsModuleArgs):StructsAttrsViews {

    const layoutViews = helpers.getLayoutViews();

    // ---------------------------- <PosAttributeItem /> ----------------------

    const TDPosAttributeItem:React.SFC<{
        idx:number;
        label:string;
        n:string;
        isSelected:boolean;
        isLocked:boolean;

    }> = (props) => {

        const handleClick = () => {
            dispatcher.dispatch<Actions.ToggleAttribute>({
                name: ActionName.ToggleAttribute,
                payload: {
                    idx: props.idx
                }
            });
        };

        return (
            <td className={`display-chk`} onClick={handleClick} >
                <input type="checkbox" name="setattrs" value={props.n}
                        checked={props.isSelected ? true : false} onChange={()=>undefined} />
            </td>
        );
    };

    // ---------------------------- <SelectAll /> ----------------------

    const SelectAll:React.SFC<{
        isSelected:boolean;
        label?:string;
        onChange:(evt:React.ChangeEvent<{}>)=>void;

    }> = (props) => {

        return (
            <label>
                <input className="select-all" type="checkbox"
                        onChange={props.onChange} checked={props.isSelected} />
                {props.label ? props.label : helpers.translate('global__select_all')}
            </label>
        );
    };

    // ---------------------------- <AttributesTweaks /> ----------------------

    const AttributesTweaks:React.SFC<{
        attrsVmode:ViewOptions.AttrViewMode;
        showConcToolbar:boolean;

    }> = (props) => {

        const handleSelectChangeFn = (event:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch<Actions.UpdateAttrVisibility>({
                name: ActionName.UpdateAttrVisibility,
                payload: {
                    value: event.target.value as ViewOptions.AttrViewMode
                }
            });
        };

        return (
            <div className="AttributesTweaks">
                <ul>
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
                            <input type="radio" value={ViewOptions.AttrViewMode.VISIBLE_MULTILINE}
                                    checked={props.attrsVmode === ViewOptions.AttrViewMode.VISIBLE_MULTILINE}
                                    onChange={handleSelectChangeFn} />
                            <span>{helpers.translate('options__vmode_switch_visible_2line')}</span>
                        </label>
                    </li>
                </ul>
            </div>
        );
    };

    // ---------------------------- <AttributesCheckboxes /> ----------------------

    const AttributesCheckboxes:React.SFC<{
        attrList:Array<ViewOptions.AttrDesc>;
        basePosAttr:string;
        baseViewAttr:string;
        hasSelectAll:boolean;
        attrsVmode:ViewOptions.AttrViewMode;
        showConcToolbar:boolean;

    }> = (props) => {

        const handleSelectAll = () => {
            dispatcher.dispatch<Actions.ToggleAllAttributes>({
                name: ActionName.ToggleAllAttributes
            });
        };


        const handlePrimaryAttrSel = (attr:string) => (evt:React.MouseEvent) => {
            dispatcher.dispatch<Actions.SetBaseViewAttr>({
                name: ActionName.SetBaseViewAttr,
                payload: {
                    value: attr
                }
            });
        };

        return (
            <div className="AttributesCheckboxes">
                <h2 className="label">{helpers.translate('options__which_attrs_show_hd')}</h2>
                <table className="attr-selection">
                    <thead>
                        <tr>
                            <th />
                            <th>{helpers.translate('options__display_attributes')}</th>
                            <th>{helpers.translate('options__display_use_for_text')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {props.attrList.map((item, i) => (
                            <tr key={`${i}:${item.n}`}>
                                <th className="row-hd attr">
                                    {item.label}
                                </th>
                                <TDPosAttributeItem key={'atrr:' + item.n} idx={i} n={item.n} label={item.label}
                                        isSelected={item.selected} isLocked={item.n === props.basePosAttr} />
                                <td className="unique-sel" onClick={handlePrimaryAttrSel(item.n)}>
                                    <input type="radio" name="mainViewAttr" checked={item.n === props.baseViewAttr} onChange={()=>undefined} />
                                </td>
                            </tr>
                        ))}
                        <tr className="func">
                            <td />
                            <td className="select-whole-col">
                                <SelectAll onChange={handleSelectAll} isSelected={props.hasSelectAll} />
                            </td>
                            <td />
                        </tr>
                    </tbody>
                </table>
                <h2 className="label">
                    {helpers.translate('options__attr_apply_header')}
                </h2>
                <AttributesTweaks attrsVmode={props.attrsVmode} showConcToolbar={props.showConcToolbar} />
            </div>
        );
    };

    // ---------------------------- <GeneralAttrList /> ----------------------

     const AttrList:React.SFC<{
        ident:string;
        items:Array<ViewOptions.StructAttrDesc|ViewOptions.RefAttrDesc>;
        hasSelectAll:boolean;
        handleClick:(v:string)=>void;
        handleAllClick:(v:string)=>void;

    }> = (props) => (
        <>
            <div className="AttrList">
                <ul>
                    {props.items.map((item, i) => {
                        return (
                            <li key={i}>
                                <label>
                                    <input type="checkbox" name="structattrs" value={`${props.ident}.${item.n}`}
                                        checked={item.selected} onChange={() => props.handleClick(item.n)} />
                                    {'label' in item ? item.label : item.n}
                                </label>
                            </li>
                        );
                    })}
                </ul>
            </div>
            <SelectAll onChange={() => props.handleAllClick(props.ident)} isSelected={props.hasSelectAll} />
        </>
    );

    // ---------------------------- <StructsAndAttrsCheckboxes /> ----------------------

    const StructsAndAttrsCheckboxes:React.SFC<{
        availStructs:Array<ViewOptions.StructDesc>;
        structAttrs:ViewOptions.AvailStructAttrs;
        corpusUsesRTLText:boolean;
        hasSelectAll:boolean;
    }> = (props) => {

        const handleSelect = (structIdent) => {
            return (structAttrIdent) => {
                dispatcher.dispatch<Actions.ToggleStructure>({
                    name: ActionName.ToggleStructure,
                    payload: {
                        structIdent,
                        structAttrIdent
                    }
                });
            };
        };

        const handleSelectCategory = (event) => {
            dispatcher.dispatch<Actions.ToggleStructure>({
                name: ActionName.ToggleStructure,
                payload: {
                    structIdent: event.target.value,
                    structAttrIdent: null
                }
            });
        };

        const handleSelectCategoryAll = (structIdent) => {
            dispatcher.dispatch<Actions.ToggleAllStructureAttrs>({
                name: ActionName.ToggleAllStructureAttrs,
                payload: {structIdent}
            });
        };

        const handleSelectAll = (evt) => {
            dispatcher.dispatch<Actions.ToggleAllStructures>({
                name: ActionName.ToggleAllStructures
            });
        };

        return (
            <section className="StructsAndAttrsCheckboxes">
                {props.corpusUsesRTLText ?
                    <p className="warning">
                        <img className="icon"
                                src={helpers.createStaticUrl('img/warning-icon.svg')}
                                alt={helpers.translate('global__warning_icon')} />
                        {helpers.translate('options__rtl_text_warning')}
                    </p> :
                    null}
                <div className="struct-groups">
                    {List.map(
                        (item) => (
                            <div key={item.n} className="group">
                                <label className="struct">
                                    <input type="checkbox" name="setstructs" value={item.n}
                                            checked={item.selected} onChange={handleSelectCategory} />
                                    {'<' + item.n + '>'}
                                </label>
                                <AttrList
                                    ident={item.n}
                                    items={props.structAttrs[item.n] || []}
                                    handleClick={handleSelect(item.n)}
                                    handleAllClick={handleSelectCategoryAll}
                                    hasSelectAll={item.selectAllAttrs} />
                            </div>
                        ),
                        props.availStructs
                    )}
                </div>
                <div className="select-all-structs-and-groups">
                    <hr />
                    <SelectAll onChange={handleSelectAll} isSelected={props.hasSelectAll}
                        label={helpers.translate('options__select_all_in_all_structs')} />
                </div>
            </section>
        );
    };

    // ---------------------------- <ConcLineRefCheckboxes /> ----------------------

    const ConcLineRefCheckboxes:React.SFC<{
        availRefs:Array<ViewOptions.RefDesc>;
        refAttrs:{[key:string]:Array<ViewOptions.RefAttrDesc>};
        hasSelectAll:boolean;
    }> = (props) => {

        const handleSelect = (refIdent) => (refAttrIdent:string) => {
            dispatcher.dispatch<Actions.ToggleReference>({
                name: ActionName.ToggleReference,
                payload: {
                    refIdent,
                    refAttrIdent
                }
            });
        };

        const handleSelectCategory = (event) => {
            dispatcher.dispatch<Actions.ToggleReference>({
                name: ActionName.ToggleReference,
                payload: {
                    refIdent: event.target.value,
                    refAttrIdent: null
                }
            });
        };

        const handleSelectCategoryAll = (refIdent:string) => {
            dispatcher.dispatch<Actions.ToogleAllReferenceAttrs>({
                name: ActionName.ToogleAllReferenceAttrs,
                payload: {refIdent}
            });
        };

        const handleSelectAll = (evt) => {
            dispatcher.dispatch<Actions.ToggleAllReferences>({
                name: ActionName.ToggleAllReferences
            });
        };

        return (
            <section>
                <div className="struct-groups">
                    {List.map(item =>
                        <div key={item.n} className="group">
                            <label className="struct">
                                <input type="checkbox" name="setrefs" value={item.n}
                                        checked={item.selected} onChange={handleSelectCategory} />
                                {'<' + item.n + '>'}
                            </label>
                            <AttrList
                                ident={item.n}
                                items={props.refAttrs[item.n]}
                                hasSelectAll={item.selectAllAttrs}
                                handleClick={handleSelect(item.n)}
                                handleAllClick={handleSelectCategoryAll} />
                        </div>,
                        props.availRefs
                    )}
                </div>
                <div className="select-all-structs-and-groups">
                    <hr />
                    <SelectAll onChange={handleSelectAll} isSelected={props.hasSelectAll}
                        label={helpers.translate('options__select_all_in_all_structs')} />
                </div>
            </section>
        );
    };

    // ---------------------------- <QueryHints /> ----------------------

    const Extensions:React.SFC<{
        queryHintMode:PluginInterfaces.QuerySuggest.SuggestionVisibility;
        availProviders:Array<string>;

    }> = (props) => {

        const handleSelectChangeFn = (event:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch<Actions.ChangeQuerySuggestionMode>({
                name: ActionName.ChangeQuerySuggestionMode,
                payload: {
                    value: parseInt(event.target.value) as PluginInterfaces.QuerySuggest.SuggestionVisibility
                }
            });
        };

        return (
            <section>
                <div className="Extensions">
                    <fieldset>
                        <legend className="label">{helpers.translate('options__query_suggestions_label')}</legend>
                        <ul className="switch">
                            <li>
                                <label>
                                    <input type="radio" name="queryHintMode"
                                        checked={props.queryHintMode === PluginInterfaces.QuerySuggest.SuggestionVisibility.DISABLED}
                                        value={PluginInterfaces.QuerySuggest.SuggestionVisibility.DISABLED}
                                        onChange={handleSelectChangeFn} />
                                    <span>{helpers.translate('options__query_suggestions_disabled')}</span>
                                </label>
                            </li>
                            <li>
                                <label>
                                    <input type="radio" name="queryHintMode"
                                        checked={props.queryHintMode === PluginInterfaces.QuerySuggest.SuggestionVisibility.MANUAL}
                                        value={PluginInterfaces.QuerySuggest.SuggestionVisibility.MANUAL}
                                        onChange={handleSelectChangeFn} />
                                    <span>{helpers.translate('options__query_suggestions_manual')}</span>
                                </label>
                            </li>
                            <li>
                                <label>
                                    <input type="radio" name="queryHintMode"
                                        checked={props.queryHintMode === PluginInterfaces.QuerySuggest.SuggestionVisibility.AUTO}
                                        value={PluginInterfaces.QuerySuggest.SuggestionVisibility.AUTO}
                                        onChange={handleSelectChangeFn} />
                                    <span>{helpers.translate('options__query_suggestions_auto')}</span>
                                </label>
                            </li>
                        </ul>
                        <p className="configured-items note">
                            {helpers.translate('options__currently_avail_qs_providers')}:{'\u00a0'}
                            {!List.empty(props.availProviders) ?
                                <>
                                    {List.map(
                                        (v, i) => <React.Fragment key={`item:${i}`}>{i > 0 ? ', ' : ''}
                                            <span className="item">&quot;{v}&quot;</span>
                                        </React.Fragment>,
                                        props.availProviders
                                    )}
                                </> :
                                null
                            }
                        </p>
                    </fieldset>
                </div>
            </section>
        );
    };

    // ---------------------------- <SubmitButtons /> ----------------------

    const SubmitButtons:React.SFC<{
        isWaiting:boolean;

    }> = (props) => {

        const handleSaveClick = () => {
            dispatcher.dispatch<OptionsActions.SaveSettings>({
                name: OptionsActionName.SaveSettings
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
        attrList:Array<ViewOptions.AttrDesc>;
        baseViewAttr:string;
        basePosAttr:string;
        availStructs:Array<ViewOptions.StructDesc>;
        hasSelectAllAttrs:boolean;
        showConcToolbar:boolean;
        attrsVmode:ViewOptions.AttrViewMode;
        structAttrs:ViewOptions.AvailStructAttrs;
        hasSelectAllStruct:boolean;
        availRefs:Array<ViewOptions.RefDesc>;
        refAttrs:{[key:string]:Array<ViewOptions.RefAttrDesc>};
        hasSelectAllRefs:boolean;
        isWaiting:boolean;
        userIsAnonymous:boolean;
        corpusUsesRTLText:boolean;
        queryHintMode:PluginInterfaces.QuerySuggest.SuggestionVisibility;
        queryHintAvailable:boolean;
        availQSProviders:Array<string>;

    }> = (props) => {

        if (props.hasLoadedData) {
            const items = ([
                {
                    id: 'attributes',
                    label: helpers.translate('options__attributes_hd')
                },
                {
                    id: 'structures',
                    label: helpers.translate('options__structures_hd')
                },
                {
                    id: 'references',
                    label: helpers.translate('options__references_hd')
                },
                {
                    id: 'hints',
                    label: helpers.translate('options__extensions_hd')
                }
            ])

            return (
                <form method={HTTP.Method.POST} className="StructsAndAttrsForm" action={helpers.createActionLink('options/viewattrsx')}>
                    <div>
                        <layoutViews.TabView
                            className="FieldsetsTabs"
                            items={items}>

                            <AttributesCheckboxes
                                attrList={props.attrList}
                                basePosAttr={props.basePosAttr}
                                baseViewAttr={props.baseViewAttr}
                                hasSelectAll={props.hasSelectAllAttrs}
                                attrsVmode={props.attrsVmode}
                                showConcToolbar={props.showConcToolbar} />

                            <StructsAndAttrsCheckboxes
                                availStructs={props.availStructs}
                                structAttrs={props.structAttrs}
                                hasSelectAll={props.hasSelectAllStruct}
                                corpusUsesRTLText={props.corpusUsesRTLText} />

                            <ConcLineRefCheckboxes
                                availRefs={props.availRefs}
                                refAttrs={props.refAttrs}
                                hasSelectAll={props.hasSelectAllRefs} />

                            <Extensions queryHintMode={props.queryHintMode}
                                    availProviders={props.availQSProviders} />
                        </layoutViews.TabView>

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

    const StructAttrsViewOptions:React.SFC<StructAttrsViewOptionsProps & CorpusViewOptionsModelState> = (props) => (
        <div className="StructAttrsViewOptions">
            <StructsAndAttrsForm
                    fixedAttr={props.fixedAttr}
                    attrList={props.attrList}
                    basePosAttr={props.basePosAttr}
                    baseViewAttr={props.baseViewAttr}
                    hasSelectAllAttrs={props.selectAllAttrs}
                    availStructs={props.structList}
                    structAttrs={props.structAttrs}
                    hasSelectAllStruct={props.selectAllStruct}
                    availRefs={props.refList}
                    refAttrs={props.refAttrs}
                    hasSelectAllRefs={props.selectAllRef}
                    hasLoadedData={props.hasLoadedData}
                    attrsVmode={props.attrVmode}
                    showConcToolbar={props.showConcToolbar}
                    isWaiting={props.isBusy}
                    userIsAnonymous={props.userIsAnonymous}
                    corpusUsesRTLText={props.corpusUsesRTLText}
                    queryHintMode={props.qsVisibilityMode}
                    queryHintAvailable={props.qsPluginAvaiable}
                    availQSProviders={props.qsProviders} />
        </div>
    );

    return {
        StructAttrsViewOptions: BoundWithProps(StructAttrsViewOptions, viewOptionsModel)
    };

}