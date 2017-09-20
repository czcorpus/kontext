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

import * as React from 'vendor/react';


export function init(dispatcher, he, concArgHandler, mainMenuStore, asyncTaskStore, layoutViews) {

    // ----------------------------- <ConcDependentItem /> --------------------------

    const ConcDependentItem = (props) => {

        const createLink = () => {
            return he.createActionLink(props.data.action + '?' +
                    concArgHandler.exportConcArgs(props.data.args, props.data.q));
        };

        return (
            <li>
                <a href={createLink()}>
                    {props.data.label}
                    {props.data.indirect ? '\u2026' : null}
                </a>
            </li>
        );
    };

    // ----------------------------- <Item /> --------------------------

    const Item = (props) => {

        const createLink = () => {
            if (props.data.url) {
                return props.data.url;

            } else if (props.data.action && typeof props.data.args === 'string') {
                return he.createActionLink(props.data.action + '?' + props.data.args);

            } else if (props.data.action) {
                return he.createActionLink(props.data.action, props.data.args);
            }
            return undefined;
        };

        const clickHandler = () => {
            if (typeof props.data.boundAction === 'function') {
                props.data.boundAction();
            }
        };

        return (
            <li>
                <a href={createLink()} onClick={clickHandler}
                        target={props.data.openInBlank ? '_blank' : null}>
                    {props.data.label}
                    {props.data.indirect ? '\u2026' : null}
                </a>
            </li>
        );
    };


    // ----------------------------- <DisabledItem /> ----------------------

    const DisabledItem = (props) => {

        return (
            <span className="disabled">
                {props.data.label}
            </span>
        );
    };

    // ----------------------------- <EventTriggeringItem /> -----------------

    const EventTriggeringItem = (props) => {

        const handleClick = () => {
            dispatcher.dispatch({
                actionType: props.data.message,
                props: props.data.args
            });
            props.closeActiveSubmenu();
        };

        return (
            <li>
                <a onClick={handleClick}>
                    {he.translate(props.data.label)}
                    {props.data.indirect ? '\u2026' : null}
                </a>
            </li>
        );
    };


    // ----------------------------- <SubMenu /> --------------------------

    const SubMenu = (props) => {

        const createItem = (item, key) => {
            if (item.disabled) {
                return <DisabledItem key={key} data={item} />;

            } else if (item.message) {
                return <EventTriggeringItem key={key} data={item}
                            closeActiveSubmenu={props.closeActiveSubmenu} />;

            } else if (item.currConc) {
                return <ConcDependentItem key={key} data={item} />;

            } else if (typeof item.boundAction === 'function' || item.boundAction === undefined) {
                return <Item key={key} data={item} />;
            }
        };

        const renderSubmenu = () => {
            if (props.items.size > 0) {
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
        if (props.items.size === 0 || props.isDisabled) {
            htmlClasses.push('disabled');
        }

        return (
            <li className={htmlClasses.join(' ')}
                    onMouseOver={props.handleMouseOver}
                    onMouseLeave={props.handleMouseOut}>
                <a className="trigger"
                    title="">{props.label}</a>
                {props.isOpened ? renderSubmenu() : null}
            </li>
        );
    };

    // ----------------------------- <AsyncTaskList /> --------------------------

    const AsyncTaskList = (props) => {

        return (
            <layoutViews.ModalOverlay onCloseKey={props.closeClickHandler}>
                <layoutViews.PopupBox onCloseClick={props.closeClickHandler} customClass="async-task-list">
                    <table>
                        <tbody>
                            <tr>
                                <th>{he.translate('global__task_category')}</th>
                                <th>{he.translate('global__task_label')}</th>
                                <th>{he.translate('global__task_created')}</th>
                                <th>{he.translate('global__task_status')}</th>
                            </tr>
                            {props.items.map(item => (
                                <tr key={item.ident}>
                                    <td>{he.translate(`task__type_${item.category}`)}</td>
                                    <td>{item.label}</td>
                                    <td>{he.formatDate(new Date(item.created * 1000), 2)}</td>
                                    <td className="status">
                                        {he.translate(`task__status_${item.status}`)}
                                        {item.status === 'FAILURE' ?
                                            <img src={he.createStaticUrl('img/error-icon.svg')} alt={item.status} />
                                            : null }
                                    </td>
                                </tr>
                            ))}
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

    class LiAsyncTaskNotificator extends React.Component {

        constructor(props) {
            super(props);
            this._handleCloseClick = this._handleCloseClick.bind(this);
            this._handleViewListClick = this._handleViewListClick.bind(this);
            this._handleClearOnCloseCheckbox = this._handleClearOnCloseCheckbox.bind(this);
            this._handleOkButtonClick = this._handleOkButtonClick.bind(this);
            this.state = {
                taskList: null,
                removeFinishedOnSubmit: true
            };
        }

        _handleCloseClick() {
            this.setState({
                taskList: null,
                removeFinishedOnSubmit: true
            });
        }

        _handleViewListClick() {
            this.setState({
                taskList: asyncTaskStore.getAsyncTasks(),
                removeFinishedOnSubmit: this.state.removeFinishedOnSubmit
            });
        }

        _handleClearOnCloseCheckbox() {
            this.setState({
                taskList: this.state.taskList,
                removeFinishedOnSubmit: !this.state.removeFinishedOnSubmit
            });
        }

        _handleOkButtonClick(evt) {
            if (this.state.removeFinishedOnSubmit) {
                dispatcher.dispatch({
                    actionType: 'INBOX_CLEAR_FINISHED_TASKS',
                    props: {}
                });
            }
            this._handleCloseClick();
        }

        _renderHourglass() {
            if (this.props.numRunning > 0) {
                const title = he.translate('global__there_are_tasks_running_{num_tasks}', {num_tasks: this.props.numRunning});
                return <a title={title}>{'\u231B'}</a>;

            } else {
                return null;
            }
        }

        _renderEnvelope() {
            if (this.props.numFinished > 0) {
                const title = he.translate('global__there_are_tasks_finished_{num_tasks}', {num_tasks: this.props.numFinished});
                return <a title={title}>{'\u2709'}</a>;

            } else {
                return null;
            }
        }

        render() {
            if (this.props.numFinished > 0 || this.props.numRunning > 0) {
                return (
                    <li className="notifications">
                        <span onClick={this._handleViewListClick}>
                            {this._renderHourglass()}
                            {'\u00A0'}
                            {this._renderEnvelope()}
                        </span>
                        {this.state.taskList !== null ?
                            <AsyncTaskList items={this.state.taskList}
                                    closeClickHandler={this._handleCloseClick}
                                    handleOkButtonClick={this._handleOkButtonClick}
                                    handleClearOnCloseCheckbox={this._handleClearOnCloseCheckbox}
                                    clearOnCloseCheckboxStatus={this.state.removeFinishedOnSubmit} />
                            : null}
                    </li>
                );

            } else {
                return null;
            }
        }
    }


    // ----------------------------- <MainMenu /> --------------------------

    class MainMenu extends React.Component {

        constructor(props) {
            super(props);
            this._handleHoverChange = this._handleHoverChange.bind(this);
            this._storeChangeListener = this._storeChangeListener.bind(this);
            this._closeActiveSubmenu = this._closeActiveSubmenu.bind(this);
            this.state = {
                currFocus: null,
                numRunningTasks: asyncTaskStore.getNumRunningTasks(),
                numFinishedTasks: asyncTaskStore.getNumFinishedTasks(),
                menuItems: mainMenuStore.getData()
            };
        }

        _handleHoverChange(ident, enable) {
            const newState = he.cloneState(this.state);
            if (!enable) {
                newState.currFocus = null;

            } else {
                newState.currFocus = ident;
            }
            this.setState(newState);
        }

        _storeChangeListener(store, action) {
            this.setState({
                currFocus: this.state.currFocus,
                numRunningTasks: asyncTaskStore.getNumRunningTasks(),
                numFinishedTasks: asyncTaskStore.getNumFinishedTasks(),
                menuItems: mainMenuStore.getData()
            });
        }

        componentDidMount() {
            asyncTaskStore.addChangeListener(this._storeChangeListener);
            mainMenuStore.addChangeListener(this._storeChangeListener);
        }

        componentWillUnmount() {
            asyncTaskStore.removeChangeListener(this._storeChangeListener);
            mainMenuStore.removeChangeListener(this._storeChangeListener);
        }

        _closeActiveSubmenu() {
            const newState = he.cloneState(this.state);
            newState.currFocus = null;
            this.setState(newState);
        }

        render() {
            return (
                <ul id="menu-level-1">
                    {this.state.menuItems.map(item => {
                        const mouseOverHandler = item[1].disabled ? null : this._handleHoverChange.bind(this, item[0], true);
                        const mouseOutHandler = item[1].disabled ? null : this._handleHoverChange.bind(this, item[0], false);
                        return <SubMenu key={item[0]} label={item[1].label}
                                    items={item[1].items}
                                    isDisabled={item[1].disabled}
                                    isOpened={this.state.currFocus === item[0]}
                                    handleMouseOver={mouseOverHandler}
                                    handleMouseOut={mouseOutHandler}
                                    closeActiveSubmenu={this._closeActiveSubmenu} />;
                    })}
                    <LiAsyncTaskNotificator numRunning={this.state.numRunningTasks}
                        numFinished={this.state.numFinishedTasks} />
                </ul>
            );
        }
    }


    return {
        MainMenu: MainMenu
    }
}