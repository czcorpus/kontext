/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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
import { List, Dict, pipe, tuple } from 'cnc-tskit';
import { IActionDispatcher, IModel, BoundWithProps } from 'kombo';

import * as PluginInterfaces from '../../types/plugins/index.js';
import * as Kontext from '../../types/kontext.js';
import * as TextTypes from '../../types/textTypes.js';
import { TTSelOps } from '../../models/textTypes/selectionOps.js';
import { TextTypesModelState } from '../../models/textTypes/main.js';
import { Actions } from '../../models/textTypes/actions.js';
import { WidgetView } from '../../models/textTypes/common.js';
import { init as listSelectorInit } from './list.js';
import { init as rawInputMultiValSelectorInit } from './input.js';
import { init as daysSelectorInit } from './days.js';
import * as S from './style.js';


export interface TextTypesPanelProps {
    LiveAttrsView:PluginInterfaces.LiveAttributes.View;
    LiveAttrsCustomTT:PluginInterfaces.LiveAttributes.CustomAttribute;
    controls?:Array<React.JSX.Element>;
}



export interface TextTypeAttributeMinIconProps {
    isMinimized:boolean;
    onClick:()=>void;
}


export interface TextTypesViews {
    TextTypesPanel:React.ComponentClass<TextTypesPanelProps>;
    TextTypeAttributeMinIcon:React.FC<TextTypeAttributeMinIconProps>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers, textTypesModel:IModel<TextTypesModelState>):TextTypesViews {

    const layoutViews = he.getLayoutViews();
    const FullListSelector = listSelectorInit(dispatcher, he);
    const RawInputMultiValueContainer = rawInputMultiValSelectorInit(dispatcher, he);
    const CalendarDaysSelector = daysSelectorInit(dispatcher, he);


    // ----------------------------- <ExtendedInfoBox /> --------------------------

    const ExtendedInfoBox:React.FC<{
        attrName:string;
        ident:string;
        data:TextTypes.ExtendedInfo;

    }> = (props) => {

        const clickCloseHandler = () => {
            dispatcher.dispatch<typeof Actions.ExtendedInformationRemoveRequest>({
                name: Actions.ExtendedInformationRemoveRequest.name,
                payload: {
                    attrName: props.attrName,
                    ident: props.ident
                }
            });
        };

        const renderContent = () =>
            Array.isArray(props.data) ?
                (<ul>
                    {pipe(
                        props.data,
                        List.map(
                            ([attr, value]) => (
                                <li key={attr}>
                                    <strong>{attr.replace('_', '.')}:</strong>
                                    {'\u00A0'}{value}
                                </li>
                            )
                        )
                    )}
                </ul>
                ) :
                <div className="message"><p>{props.data.__message__}</p></div>;


        return (
            <layoutViews.PopupBox onCloseClick={clickCloseHandler}
                        customClass="metadata-detail"
                        customStyle={{marginLeft: '5em'}}>
                {renderContent()}
            </layoutViews.PopupBox>
        );
    };

    // ----------------------------- <ValueSelector /> --------------------------

    const ValueSelector:React.FC<{
        attrObj:TextTypes.AnyTTSelection;
        widget:{widget:WidgetView; active:boolean};
        isLocked:boolean;
        hasExtendedInfo:boolean;
        textInputPlaceholder:string;
        isBusy:boolean;
        isAutocompleteActive:boolean;
        firstDayOfWeek:'mo'|'su'|'sa';

    }> = (props) => {

        const renderSelector = () => {
            if (props.attrObj.type === 'full') {
                return <FullListSelector attrObj={props.attrObj}
                        widget={props.widget}
                        hasExtendedInfo={props.hasExtendedInfo}
                        isBusy={props.isBusy}
                        hasSelectedItems={TTSelOps.hasUserChanges(props.attrObj, true)}
                        isNegativeSelection={props.attrObj.excludeSelection} />;

            } else if (props.attrObj.type === 'regexp') {
                if (props.widget.widget === 'days') {
                    if (props.attrObj.isLocked) {
                        return (
                            <p>
                                {he.translate('query__tt_regexp_value_label')}:
                                {'\u00a0' + props.attrObj.textFieldDecoded}
                            </p>
                        );
                    }
                    return <CalendarDaysSelector attrObj={props.attrObj} firstDayOfWeek={props.firstDayOfWeek} />;
                }
                return null;

            } else {
                return <RawInputMultiValueContainer
                        attrObj={(props.attrObj)}
                        isLocked={props.isLocked}
                        hasExtendedInfo={props.hasExtendedInfo}
                        textInputPlaceholder={props.textInputPlaceholder}
                        isBusy={props.isBusy}
                        isAutoCompleteActive={props.isAutocompleteActive}
                        isNegativeSelection={props.attrObj.excludeSelection} />;
            }
        }

        return (
            <S.ValueSelector>
                {renderSelector()}
            </S.ValueSelector>
        );
    };

    // --------------------- <TextTypeAttributeMinIcon /> -----------------

    const TextTypeAttributeMinIcon:React.FC<TextTypeAttributeMinIconProps> = (props) => {

        return (
            <S.TextTypeAttributeMinIcon>
                <a onClick={props.onClick}>
                    {props.isMinimized ?
                        <layoutViews.ImgWithMouseover src={he.createStaticUrl('img/maximize-icon.svg')}
                            alt="maximize" /> :
                        <layoutViews.ImgWithMouseover src={he.createStaticUrl('img/minimize-icon.svg')}
                        alt="minimize" />
                    }
                </a>
            </S.TextTypeAttributeMinIcon>
        );
    }

    // ---------------------------- <TableTextTypeFooter /> ------------------------------

    const TableTextTypeFooter:React.FC<{
        attrObj:TextTypes.AnyTTSelection;
        widget:{widget:WidgetView; active:boolean};

    }> = (props) => {

        const excludeSelectionClickHandler = (checked:boolean) => {
            dispatcher.dispatch<typeof Actions.NegativeSelectionClicked>({
                name: Actions.NegativeSelectionClicked.name,
                payload: {
                    attrName: props.attrObj.name,
                    checked
                }
            });
        };

        const renderModeSwitch = () => (
            <select className="select-mode" onChange={intervalModeSwitchHandler}
                    value={props.widget.active ? 'r' : 'i'}>
                <option value="i">{he.translate('query__tt_select_individual')}</option>
                <option value="r">{he.translate('query__tt_select_range')}</option>
            </select>
        );

        const intervalModeSwitchHandler = () => {
            dispatcher.dispatch<typeof Actions.ToggleRangeMode>({
                name: Actions.ToggleRangeMode.name,
                payload: {
                    attrName: props.attrObj.name
                }
            });
        };

        const [sectionLocked, someItemsSelected]  = (() => {
            switch (props.attrObj.type) {
                case 'full':
                case 'text':
                    return tuple(
                        !List.empty(props.attrObj.values) && List.every(v => v.locked, props.attrObj.values),
                        List.some(v => v.selected, props.attrObj.values)
                    );
                default:
                    return tuple(false, false);
            }
        })();

        return (
            <S.TableTextTypeFooter>
            {
                props.attrObj.type === 'full' && !TTSelOps.isLocked(props.attrObj) && props.widget.widget ?
                    renderModeSwitch() :
                    null
            }
            {
                someItemsSelected ?
                    <>
                        <layoutViews.ToggleSwitch
                            htmlClass="toggle-switch"
                            checked={props.attrObj.excludeSelection}
                            disabled={sectionLocked}
                            onChange={excludeSelectionClickHandler} />
                        <label className={sectionLocked ? 'locked' : null}
                                onClick={() => sectionLocked ?
                                    undefined :
                                    excludeSelectionClickHandler(!props.attrObj.excludeSelection)}>
                            {he.translate('query__tt_negative_selection')}:{'\u00a0'}
                        </label>
                    </> :
                    null
            }
            </S.TableTextTypeFooter>
        );
    };

    // ----------------------------- <TableTextTypeAttribute /> --------------------------

    const TableTextTypeAttribute:React.FC<{
        attrObj:TextTypes.AnyTTSelection;
        widget:{widget:WidgetView; active:boolean};
        isMinimized:boolean;
        hasExtendedInfo:boolean;
        metaInfo:TextTypes.AttrSummary;
        textInputPlaceholder:string;
        isBusy:boolean;
        firstDayOfWeek:'mo'|'su'|'sa';
        isAutocompleteActive:boolean;

    }> = (props) => {



        const renderMetaInfo = () => {
            if (props.metaInfo) {
                return (
                    <span>
                        {props.metaInfo.text}
                        {'\u00A0'}
                        <layoutViews.InlineHelp>
                            {props.metaInfo.help}
                        </layoutViews.InlineHelp>
                    </span>
                );

            } else {
                return null;
            }
        };

        const renderExtendedInfo = () => {
            if (props.attrObj.type === 'text' || props.attrObj.type === 'full') {
                const srch = List.find(item => !!item.extendedInfo, props.attrObj.values);
                if (srch) {
                    return <ExtendedInfoBox data={srch.extendedInfo} ident={srch.ident}
                                attrName={props.attrObj.name} />;
                }

            } else {
                return null;
            }
        }

        const renderAttrInfo = () => {
            if (props.attrObj.attrInfo.doc) {
                return (
                    <span className="info-link">{'\u00a0'}(
                        <a target="_blank" href={props.attrObj.attrInfo.doc}
                                title={he.translate('query__tt_click_to_see_attr_info')}>
                            {props.attrObj.attrInfo.docLabel}
                        </a>)
                    </span>
                );
            }
            return null;
        }

        const handleMinimizeIconFn = (ident:string):()=>void => {
            return () => {
                dispatcher.dispatch<typeof Actions.ToggleMinimizeItem>({
                    name: Actions.ToggleMinimizeItem.name,
                    payload: {
                        ident: ident
                    }
                });
            };
        };


        return (
            <S.TableTextTypeAttribute className={TTSelOps.isLocked(props.attrObj) ? 'locked' : null}>
                <S.AttribName>
                    <h3 title={props.attrObj.name !== props.attrObj.label ? props.attrObj.name : null}>
                        {props.attrObj.label}
                        {props.isMinimized && TTSelOps.hasUserChanges(props.attrObj, false) ?
                            <span title={he.translate('query__contains_selected_text_types')}>{'\u00a0\u2713'}</span> :
                            null
                        }
                        {renderAttrInfo()}
                        {props.isBusy ? <layoutViews.AjaxLoaderBarImage htmlClass="ajax-loader" /> : null}
                    </h3>
                    <TextTypeAttributeMinIcon isMinimized={props.isMinimized}
                            onClick={handleMinimizeIconFn(props.attrObj.name)} />
                </S.AttribName>
                {props.isMinimized ?
                    <div></div> :
                    (<>
                        <div>
                            {renderExtendedInfo()}
                        </div>
                        <div className={props.widget.active ? 'range' : 'data-rows'}>
                            <ValueSelector attrObj={props.attrObj}
                                    widget={props.widget}
                                    isLocked={TTSelOps.isLocked(props.attrObj)}
                                    hasExtendedInfo={props.hasExtendedInfo}
                                    textInputPlaceholder={props.textInputPlaceholder}
                                    isBusy={props.isBusy}
                                    firstDayOfWeek={props.firstDayOfWeek}
                                    isAutocompleteActive={props.isAutocompleteActive} />
                        </div>
                        <div className="metadata">
                            {renderMetaInfo()}
                        </div>
                        <TableTextTypeFooter
                            attrObj={props.attrObj}
                            widget={props.widget} />
                    </>)
                }
            </S.TableTextTypeAttribute>
        );
    }

    // ----------------------------- <TTAttribMinimizeSwitch /> --------------------------

    const TTAttribMinimizeSwitch:React.FC<{
        hasSomeMaximized:boolean;

    }> = (props) => {

        const handleClick = () => {
            if (props.hasSomeMaximized) {
                dispatcher.dispatch<typeof Actions.MinimizeAll>({
                    name: Actions.MinimizeAll.name
                });

            } else {
                dispatcher.dispatch<typeof Actions.MaximizeAll>({
                    name: Actions.MaximizeAll.name
                });
            }
        };

        if (props.hasSomeMaximized) {
            return <a onClick={handleClick}>{he.translate('query__tt_minimize_all_lists')}</a>;

        } else {
            return <a onClick={handleClick}>{he.translate('query__tt_maximize_all_lists')}</a>;
        }
    };

    // ----------------------------- <TextTypesPanel /> --------------------------

    const TextTypesPanel:React.FC<TextTypesPanelProps & TextTypesModelState> = (props) => (
        <S.TextTypesPanel>
            <div className="tt-controls">
                <div className="la">
                    <div className="general-controls">
                        {props.controls
                            ? (
                                <ul className="controls">
                                    {List.map(
                                        (c, i) => <li key={`gc:${i}`}>{c}</li>,
                                        props.controls,
                                    )}
                                </ul>
                            )
                            : null
                        }
                    </div>
                    {props.LiveAttrsView
                        ? <props.LiveAttrsView />
                        : <div style={{gridRowStart: 1}} />}
                </div>
                <TTAttribMinimizeSwitch hasSomeMaximized={Dict.hasValue(false, props.minimizedBoxes)} />
            </div>
            <div className="grid">
                {props.LiveAttrsCustomTT
                    ? <props.LiveAttrsCustomTT />
                    : null}
                {List.map(
                    (attrObj) => (
                        <div key={attrObj.name + ':list:' + TTSelOps.containsFullList(attrObj)}>
                            <TableTextTypeAttribute
                                    attrObj={attrObj}
                                    widget={props.attributeWidgets[attrObj.name]}
                                    isMinimized={props.minimizedBoxes[attrObj.name]}
                                    hasExtendedInfo={props.bibLabelAttr === attrObj.name}
                                    metaInfo={attrObj.metaInfo}
                                    isBusy={props.busyAttributes[attrObj.name]}
                                    textInputPlaceholder={props.textInputPlaceholder}
                                    firstDayOfWeek={props.firstDayOfWeek}
                                    isAutocompleteActive={props.isLiveAttrsActive} />
                        </div>
                    ),
                    props.attributes
                )}
            </div>
        </S.TextTypesPanel>
    );

    return {
        TextTypesPanel: BoundWithProps<TextTypesPanelProps, TextTypesModelState>(TextTypesPanel, textTypesModel),
        TextTypeAttributeMinIcon
    };

}