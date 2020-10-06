/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
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
import { List, Dict } from 'cnc-tskit';
import { IActionDispatcher, IModel, BoundWithProps } from 'kombo';

import { PluginInterfaces } from '../../types/plugins';
import { Kontext, TextTypes } from '../../types/common';
import { ExtendedInfo, TTSelOps } from '../../models/textTypes/selectionOps';
import { CoreViews } from '../../types/coreViews';
import { TextTypesModelState } from '../../models/textTypes/main';
import { Actions, ActionName } from '../../models/textTypes/actions';
import { WidgetView } from '../../models/textTypes/common';
import { init as listSelectorInit } from './list';
import { init as rawInputMultiValSelectorInit } from './input';
import { init as daysSelectorInit } from './days';


export interface TextTypesPanelProps {
    LiveAttrsView:PluginInterfaces.LiveAttributes.View;
    LiveAttrsCustomTT:PluginInterfaces.LiveAttributes.CustomAttribute;
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
        data:ExtendedInfo;

    }> = (props) => {

        const clickCloseHandler = () => {
            dispatcher.dispatch<Actions.ExtendedInformationRemoveRequest>({
                name: ActionName.ExtendedInformationRemoveRequest,
                payload: {
                    attrName: props.attrName,
                    ident: props.ident
                }
            });
        };

        const renderContent = () => {
            if (props.data.has('__message__')) {
                return <div className="message"><p>{props.data.get('__message__')}</p></div>;

            } else {
                return (
                    <ul>
                        {props.data.entrySeq().map((item) => {
                            return <li key={item[0]}><strong>{item[0]}:</strong>{'\u00A0'}{item[1]}</li>;
                        })}
                    </ul>
                );
            }
        };

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

    }> = (props) => {

        const renderSelector = () => {
            if (props.attrObj.type === 'full') {
                return <FullListSelector attrObj={props.attrObj}
                        widget={props.widget}
                        hasExtendedInfo={props.hasExtendedInfo}
                        isBusy={props.isBusy}
                        hasSelectedItems={TTSelOps.hasUserChanges(props.attrObj)} />;

            } else if (props.attrObj.type === 'regexp') {
                if (props.widget.widget === 'days') {
                    if (props.attrObj.isLocked) {
                        return <p>Selected: {props.attrObj.textFieldValue}</p>
                    }
                    return <CalendarDaysSelector attrObj={props.attrObj} />;
                }
                return null;

            } else {
                return <RawInputMultiValueContainer
                        attrObj={(props.attrObj)}
                        isLocked={props.isLocked}
                        hasExtendedInfo={props.hasExtendedInfo}
                        textInputPlaceholder={props.textInputPlaceholder}
                        isBusy={props.isBusy} />;
            }
        }

        return (
            <div className="ValueSelector">
                {renderSelector()}
            </div>
        );
    };

    // --------------------- <TextTypeAttributeMinIcon /> -----------------

    const TextTypeAttributeMinIcon:React.FC<TextTypeAttributeMinIconProps> = (props) => {

        return (
            <div className="textTypes_TextTypeAttributeMinIcon">
                <a onClick={props.onClick}>
                    {props.isMinimized ?
                        <layoutViews.ImgWithMouseover src={he.createStaticUrl('img/maximize-icon.svg')}
                            alt="maximize" /> :
                        <layoutViews.ImgWithMouseover src={he.createStaticUrl('img/minimize-icon.svg')}
                        alt="minimize" />
                    }
                </a>
            </div>
        );
    }

    // ----------------------------- <TableTextTypeAttribute /> --------------------------

    const TableTextTypeAttribute:React.FC<{
        attrObj:TextTypes.AnyTTSelection;
        widget:{widget:WidgetView; active:boolean};
        isMinimized:boolean;
        metaInfoHelpVisible:boolean;
        hasExtendedInfo:boolean;
        metaInfo:TextTypes.AttrSummary;
        textInputPlaceholder:string;
        isBusy:boolean;

    }> = (props) => {

        const renderModeSwitch = () => (
            <select className="select-mode" onChange={intervalModeSwitchHandler}
                    value={props.widget.active ? 'r' : 'i'}>
                <option value="i">{he.translate('query__tt_select_individual')}</option>
                <option value="r">{he.translate('query__tt_select_range')}</option>
            </select>
        );

        const selectAllHandler = () => {
            dispatcher.dispatch<Actions.SelectAllClicked>({
                name: ActionName.SelectAllClicked,
                payload: {
                    attrName: props.attrObj.name
                }
            });
        };

        const intervalModeSwitchHandler = () => {
            dispatcher.dispatch<Actions.ToggleRangeMode>({
                name: ActionName.ToggleRangeMode,
                payload: {
                    attrName: props.attrObj.name
                }
            });
        };

        const renderSelectAll = () => (
            <label className="select-all" style={{display: 'inline-block'}}>
                    <input type="checkbox" className="select-all" onClick={selectAllHandler} />
                        {he.translate('global__select_all')}
            </label>
        );

        const renderFooter = () => {
            if (props.attrObj.type === 'full' && !TTSelOps.isLocked(props.attrObj) && props.widget.widget) {
                if (props.widget.active) {
                    return renderModeSwitch();

                } else {
                    return <>
                        {renderSelectAll()}
                        {renderModeSwitch()}
                    </>;
                }
            }
            return null;
        }

        const metaInfoHelpClickHandler = () => {
            dispatcher.dispatch<Actions.ToggleMetaInfoView>({
                name: ActionName.ToggleMetaInfoView
            });
        }

        const helpCloseHandler = () => {
            dispatcher.dispatch<Actions.ToggleMetaInfoView>({
                name: ActionName.ToggleMetaInfoView
            });
        }

        const renderMetaInfo = () => {
            if (props.metaInfo) {
                return (
                    <span>
                        {props.metaInfo.text}
                        {'\u00A0'}
                        <a className="context-help" onClick={metaInfoHelpClickHandler}>
                            <layoutViews.ImgWithMouseover
                                src={he.createStaticUrl('img/question-mark.svg')}
                                htmlClass="over-img"
                                alt="question-mark.svg"
                                title={he.translate('global__alt_hint')} />
                        </a>
                        {props.metaInfoHelpVisible
                            ? (<layoutViews.PopupBox onCloseClick={helpCloseHandler} status="info"
                                        autoWidth={CoreViews.AutoWidth.NARROW}>
                                {props.metaInfo.help}
                                </layoutViews.PopupBox>)
                            : null}
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
                dispatcher.dispatch<Actions.ToggleMinimizeItem>({
                    name: ActionName.ToggleMinimizeItem,
                    payload: {
                        ident: ident
                    }
                });
            };
        };


        const classes = ['TableTextTypeAttribute'];
        if (TTSelOps.isLocked(props.attrObj)) {
            classes.push('locked');
        }
        return (
            <div className={classes.join(' ')}>
                <div className="attrib-name">
                    <h3 title={props.attrObj.name !== props.attrObj.label ? props.attrObj.name : null}>
                        {props.attrObj.label}
                        {
                        props.isMinimized && TTSelOps.hasUserChanges(props.attrObj) ?
                        <span title={he.translate('query__contains_selected_text_types')}>{'\u00a0\u2713'}</span> :
                        null
                        }
                        {renderAttrInfo()}
                    </h3>
                    <TextTypeAttributeMinIcon isMinimized={props.isMinimized}
                            onClick={handleMinimizeIconFn(props.attrObj.name)} />
                </div>
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
                                    isBusy={props.isBusy}  />
                        </div>
                        <div className="metadata">
                            {renderMetaInfo()}
                        </div>
                        <div className="last-line">
                            {renderFooter()}
                        </div>
                    </>)
                }
            </div>
        );
    }

    // ----------------------------- <TTAttribMinimizeSwitch /> --------------------------

    const TTAttribMinimizeSwitch:React.FC<{
        hasSomeMaximized:boolean;

    }> = (props) => {

        const handleClick = () => {
            if (props.hasSomeMaximized) {
                dispatcher.dispatch<Actions.MinimizeAll>({
                    name: ActionName.MinimizeAll
                });

            } else {
                dispatcher.dispatch<Actions.MaximizeAll>({
                    name: ActionName.MaximizeAll
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

    const TextTypesPanel:React.FC<TextTypesPanelProps & TextTypesModelState> = (props) => {

            return (
                <div className="TextTypesPanel">
                    <div className="plugin-controls">
                    {props.LiveAttrsView
                        ? <props.LiveAttrsView />
                        : null}
                    </div>
                    <div className="text-type-top-bar">
                        <TTAttribMinimizeSwitch hasSomeMaximized={Dict.hasValue(false, props.minimizedBoxes)} />
                    </div>
                    <div className="grid">
                        {props.LiveAttrsCustomTT
                            ? <div><props.LiveAttrsCustomTT /></div>
                            : null}
                        {List.map((attrObj) => {
                            return <div key={attrObj.name + ':list:' + TTSelOps.containsFullList(attrObj)}>
                                <TableTextTypeAttribute
                                        attrObj={attrObj}
                                        widget={props.attributeWidgets[attrObj.name]}
                                        isMinimized={props.minimizedBoxes[attrObj.name]}
                                        metaInfoHelpVisible={props.metaInfoHelpVisible}
                                        hasExtendedInfo={props.bibIdAttr === attrObj.name}
                                        metaInfo={props.metaInfo[attrObj.name]}
                                        isBusy={props.isBusy}
                                        textInputPlaceholder={props.textInputPlaceholder} />
                            </div>;
                            },
                            props.attributes
                        )}
                    </div>
                </div>
            );
    }

    return {
        TextTypesPanel: BoundWithProps<TextTypesPanelProps, TextTypesModelState>(TextTypesPanel, textTypesModel),
        TextTypeAttributeMinIcon: TextTypeAttributeMinIcon
    };

}