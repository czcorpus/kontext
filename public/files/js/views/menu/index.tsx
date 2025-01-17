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
import { List } from 'cnc-tskit';
import { IActionDispatcher, IModel, Bound } from 'kombo';

import * as Kontext from '../../types/kontext.js';
import { isDynamicItem, isStaticItem, isEventTriggeringItem, StaticSubmenuItem,
        DynamicSubmenuItem, MainMenuModelState } from '../../models/mainMenu/index.js';
import { Actions } from '../../models/mainMenu/actions.js';
import { AsyncTaskCheckerState, AsyncTaskChecker } from '../../models/asyncTask/index.js';
import { Actions as ATActions } from '../../models/asyncTask/actions.js';
import { ConcServerArgs } from '../../models/concordance/common.js';
import * as S from './style.js';


export interface MenuModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    mainMenuModel:IModel<MainMenuModelState>;
    asyncTaskModel:AsyncTaskChecker;
}


export interface MainMenuViews {
    MainMenu:React.ComponentClass<{}, MainMenuModelState>;
}


export function init({dispatcher, he, mainMenuModel, asyncTaskModel}:MenuModuleArgs):MainMenuViews {


    const layoutViews = he.getLayoutViews();

    // ----------------------------- <ConcDependentItem /> --------------------------

    const ConcDependentItem:React.FC<{
        concArgs:ConcServerArgs;
        data:StaticSubmenuItem;

    }> = (props) => {

        const createLink = () => {
            return he.createActionLink(
                props.data.action,
                {
                    ...props.concArgs,
                    ...props.data.args,
                }
            );
        };

        return (
            <li>
                <a className="menu-link" href={createLink()} title={props.data.hint}>
                    {props.data.label}
                    {props.data.indirect ? '\u2026' : null}
                </a>
            </li>
        );
    };

    // ----------------------------- <ExternalURLItem /> --------------------------

    const StaticItem:React.FC<{
        data:StaticSubmenuItem
    }> = (props) => {
        const createLink = () => {
            if (props.data.action) {
                if (props.data.action.indexOf('http://') === 0 ||
                            props.data.action.indexOf('https://') === 0) {
                    return props.data.action;

                } else {
                    return he.createActionLink(props.data.action, props.data.args);
                }
            }
            return undefined;
        };

        return (
            <li>
                <a className="menu-link" href={createLink()}
                        title={props.data.hint}
                        target={props.data.openInBlank ? '_blank' : null}>
                    {props.data.label}
                </a>
            </li>
        );
    }

    // ----------------------------- <Item /> --------------------------

    const DynamicItem:React.FC<{
        data:DynamicSubmenuItem

    }> = (props) => {

        const clickHandler = () => {
            if (typeof props.data.boundAction === 'function') {
                props.data.boundAction();
            }
        };

        return (
            <li>
                <a className="menu-link" onClick={clickHandler} title={props.data.hint}>
                    {props.data.label}
                    {props.data.indirect ? '\u2026' : null}
                </a>
            </li>
        );
    };

    // ----------------------------- <WaitingItem /> ----------------------

    const WaitingItem:React.FC<{
        data:{label:string};

    }> = (props) => {

        return (
            <li className="disabled">
                <span>
                    {he.translate(props.data.label)}
                    <img className="ajax-loader"
                        style={{marginLeft: "0.5em"}}
                        src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                        alt={he.translate('global__menu_waiting_item')}
                        title={he.translate('global__menu_waiting_item')} />
                </span>
            </li>
        );
    };

    // ----------------------------- <DisabledItem /> ----------------------

    const DisabledItem:React.FC<{
        data:{label:string};

    }> = (props) => {

        return (
            <li className="disabled">
                <span>
                    {he.translate(props.data.label)}
                </span>
            </li>
        );
    };

    // ----------------------------- <EventTriggeringItem /> -----------------

    const EventTriggeringItem:React.FC<{
        data: {
            message:string;
            label:string;
            indirect:boolean;
            args:Kontext.GeneralProps;
            hint:string;
        };
        closeActiveSubmenu:()=>void;
    }> = (props) => {

        const handleClick = () => {
            dispatcher.dispatch({
                name: props.data.message,
                payload: props.data.args
            });
            props.closeActiveSubmenu();
        };

        return (
            <li title={props.data.hint}>
                <a className="menu-link" onClick={handleClick}>
                    {he.translate(props.data.label)}
                    {props.data.indirect ? '\u2026' : null}
                </a>
            </li>
        );
    };


    // ----------------------------- <SubMenu /> --------------------------

    const SubMenu:React.FC<{
        isOpened:boolean;
        isDisabled:boolean;
        label:string;
        items:Array<Kontext.SubmenuItem>;
        concArgs:ConcServerArgs;
        unfinishedCalculation:boolean;
        closeActiveSubmenu:()=>void;
        handleMouseOver:()=>void;
        handleMouseOut:()=>void;

    }> = (props) => {
        const createItem = (item:Kontext.SubmenuItem, key) => {
            if (item.disabled) {
                return <DisabledItem key={key} data={item} />;

            } else if (props.unfinishedCalculation && item.currConc) {
                return <WaitingItem key={key} data={item} />;

            } else if (isEventTriggeringItem(item)) {
                return <EventTriggeringItem key={key} data={item}
                            closeActiveSubmenu={props.closeActiveSubmenu} />;

            } else if (isStaticItem(item) && item.currConc) {
                return <ConcDependentItem key={key} data={item} concArgs={props.concArgs} />;

            } else if (isStaticItem(item)) {
                return <StaticItem key={key} data={item} />;

            } else if (isDynamicItem(item)) {
                return <DynamicItem key={key} data={item} />;

            } else {
                return null;
            }
        };

        const renderSubmenu = () => {
            if (props.items.length > 0) {
                return (
                    <ul className="submenu">
                        {props.items.map((item, i) => createItem(item, i))}
                    </ul>
                );

            } else {
                return null;
            }
        };

        const htmlClasses = [];

        if (props.isOpened) {
            htmlClasses.push('active');
        }
        if (props.items.length === 0 || props.isDisabled) {
            htmlClasses.push('disabled');
        }

        return (
            <li className={htmlClasses.join(' ')}
                    onMouseOver={props.handleMouseOver}
                    onMouseLeave={props.handleMouseOut}>
                <a className="trigger menu-link"
                    title="">{props.label}</a>
                {props.isOpened ? renderSubmenu() : null}
            </li>
        );
    };

    // ----------------------------- <AsyncTaskList /> --------------------------

    const AsyncTaskList:React.FC<{
        clearOnCloseCheckboxStatus:boolean;
        items:Array<Kontext.AsyncTaskInfo>;
        closeClickHandler:()=>void;
        handleClearOnCloseCheckbox:()=>void;
        handleOkButtonClick:(evt:React.MouseEvent<{}>)=>void;

    }> = (props) => {
        return (
            <layoutViews.ModalOverlay onCloseKey={props.closeClickHandler}>
                <layoutViews.PopupBox onCloseClick={props.closeClickHandler} customClass="async-task-list">
                    <table>
                        <thead>
                            <tr>
                                <th>{he.translate('global__task_category')}</th>
                                <th>{he.translate('global__task_label')}</th>
                                <th>{he.translate('global__task_created')}</th>
                                <th>{he.translate('global__task_status')}</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {List.map(
                                item => (
                                    <tr key={item.ident}>
                                        <td className="task-type">{he.translate(`task__type_${item.category}`)}</td>
                                        <td className="label">{item.label}</td>
                                        <td className="datetime">{he.formatDate(new Date(item.created * 1000), 2)}</td>
                                        <td className="status">
                                            {he.translate(`task__status_${item.status}`)}
                                            {item.status === 'FAILURE' ?
                                                <img src={he.createStaticUrl('img/error-icon.svg')} alt={item.status} />
                                                : null }
                                        </td>
                                        <td className="msg">{
                                            item.error ?
                                            item.error :
                                                item.url && item.status === 'SUCCESS' ?
                                                <a href={item.url}>
                                                    {he.translate('global__task_result')}
                                                </a> :
                                                null
                                        }</td>
                                    </tr>
                                ),
                                props.items
                            )}
                        </tbody>
                    </table>
                    <div>
                        <div className="options">
                            <label>
                                <input type="checkbox"
                                        onChange={props.handleClearOnCloseCheckbox}
                                        checked={props.clearOnCloseCheckboxStatus} />
                                {he.translate('global__remove_finished_tasks_info')}
                            </label>
                        </div>
                        <button type="button" className="default-button"
                                onClick={props.handleOkButtonClick}>
                            {props.clearOnCloseCheckboxStatus ?
                                he.translate('global__close_and_clear_the_list') :
                                he.translate('global__close')}
                        </button>
                    </div>
                </layoutViews.PopupBox>
            </layoutViews.ModalOverlay>
        );
    };

    // ----------------------------- <LiAsyncTaskNotificator /> --------------------------

    class LiAsyncTaskNotificator extends React.PureComponent<AsyncTaskCheckerState> {

        constructor(props) {
            super(props);
            this._handleCloseClick = this._handleCloseClick.bind(this);
            this._handleClearOnCloseCheckbox = this._handleClearOnCloseCheckbox.bind(this);
            this._handleOkButtonClick = this._handleOkButtonClick.bind(this);
            this._handleViewListClick = this._handleViewListClick.bind(this);
        }

        _handleCloseClick() {
            dispatcher.dispatch<typeof ATActions.InboxCloseTaskOverview>({
                name: ATActions.InboxCloseTaskOverview.name,
                payload: {
                    preventListClear: true
                }
            });
        }

        _handleOkButtonClick(evt) {
            dispatcher.dispatch<typeof ATActions.InboxCloseTaskOverview>({
                name: ATActions.InboxCloseTaskOverview.name,
                payload: {
                    preventListClear: false
                }
            });
        }

        _handleClearOnCloseCheckbox() {
            dispatcher.dispatch<typeof ATActions.InboxToggleRemoveFinishedOnSubmit>({
                name: ATActions.InboxToggleRemoveFinishedOnSubmit.name
            });
        }

        _handleViewListClick() {
            dispatcher.dispatch<typeof ATActions.InboxToggleOverviewVisibility>({
                name: ATActions.InboxToggleOverviewVisibility.name
            });
        }

        _renderHourglass(numRunning:number) {
            if (numRunning > 0) {
                const title = he.translate(
                    'global__there_are_tasks_running_{num_tasks}',
                    {num_tasks: numRunning}
                );
                return <a className="hourglass" title={title}>
                    <layoutViews.ImgWithMouseover src={he.createStaticUrl('img/hourglass.svg')}
                                src2={he.createStaticUrl('img/hourglass.svg')}
                            alt="hourglass icon" />
                </a>;

            } else {
                return null;
            }
        }

        _renderEnvelope(numFinished:number) {
            if (numFinished > 0) {
                const title = he.translate(
                    'global__there_are_tasks_finished_{num_tasks}',
                    {num_tasks: numFinished}
                );
                return <a className="envelope" title={title}>
                    <layoutViews.ImgWithMouseover src={he.createStaticUrl('img/envelope.svg')}
                            alt="envelope icon" />
                </a>;

            } else {
                return null;
            }
        }

        render() {
            const numRunning = AsyncTaskChecker.numRunning(this.props);
            const numFinished = AsyncTaskChecker.numFinished(this.props);
            if (numFinished > 0 || numRunning > 0) {
                return (
                    <li className="notifications">
                        <span className="icons" onClick={this._handleViewListClick}>
                            {this._renderHourglass(numRunning)}
                            {this._renderEnvelope(numFinished)}
                        </span>
                        {this.props.overviewVisible ?
                            <AsyncTaskList items={this.props.asyncTasks}
                                    closeClickHandler={this._handleCloseClick}
                                    handleOkButtonClick={this._handleOkButtonClick}
                                    handleClearOnCloseCheckbox={this._handleClearOnCloseCheckbox}
                                    clearOnCloseCheckboxStatus={this.props.removeFinishedOnSubmit} />
                            : null}
                    </li>
                );

            } else {
                return null;
            }
        }
    }


    const BoundLiAsyncTaskNotificator = Bound(LiAsyncTaskNotificator, asyncTaskModel);


    // ----------------------------- <MainMenu /> --------------------------

    class MainMenu extends React.PureComponent<MainMenuModelState> {

        constructor(props) {
            super(props);
            this._handleHoverChange = this._handleHoverChange.bind(this);
            this._closeActiveSubmenu = this._closeActiveSubmenu.bind(this);
        }

        _handleHoverChange(ident, enable) {
            if (!enable) {
                dispatcher.dispatch<typeof Actions.ClearVisibleSubmenu>({
                    name: Actions.ClearVisibleSubmenu.name,
                    payload: {value: ident}
                });

            } else {
                dispatcher.dispatch<typeof Actions.SetVisibleSubmenu>({
                    name: Actions.SetVisibleSubmenu.name,
                    payload: {value: ident}
                });
            }
        }

        _closeActiveSubmenu() {
            dispatcher.dispatch<typeof Actions.ClearVisibleSubmenu>({
                name: Actions.ClearVisibleSubmenu.name
            });
        }

        render() {
            return (
                <S.MainMenuUL>
                    {List.map(
                        ([itemId, item]) => {
                            const mouseOverHandler = item.disabled ?
                                null : this._handleHoverChange.bind(this, itemId, true);
                            const mouseOutHandler = item.disabled ?
                                null : this._handleHoverChange.bind(this, itemId, false);
                            return <SubMenu key={itemId} label={item.label}
                                        items={item.items}
                                        isDisabled={item.disabled}
                                        isOpened={this.props.visibleSubmenu === itemId}
                                        handleMouseOver={mouseOverHandler}
                                        handleMouseOut={mouseOutHandler}
                                        closeActiveSubmenu={this._closeActiveSubmenu}
                                        concArgs={this.props.concArgs}
                                        unfinishedCalculation={this.props.unfinishedCalculation} />;
                        },
                        this.props.data
                    )}
                    <BoundLiAsyncTaskNotificator  />
                </S.MainMenuUL>
            );
        }
    }


    return {
        MainMenu: Bound(MainMenu, mainMenuModel)
    }
}