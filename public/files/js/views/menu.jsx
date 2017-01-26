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

import React from 'vendor/react';


export function init(dispatcher, mixins, concArgHandler, mainMenuStore, asyncTaskStore, layoutViews) {

    // ----------------------------- <ConcDependentItem /> --------------------------

    const ConcDependentItem = React.createClass({

        mixins : mixins,

        _createLink : function () {
            return this.createActionLink(this.props.data.action + '?' +
                    concArgHandler.exportConcArgs(this.props.data.args, this.props.data.q));
        },

        render : function () {
            return (
                <li>
                    <a href={this._createLink()}>
                        {this.props.data.label}
                        {this.props.data.indirect ? '\u2026' : null}
                    </a>
                </li>
            );
        }
    });

    // ----------------------------- <Item /> --------------------------

    const Item = React.createClass({

        mixins : mixins,

        _createLink : function () {
            if (this.props.data.url) {
                return this.props.data.url;

            } else if (this.props.data.action && typeof this.props.data.args === 'string') {
                return this.createActionLink(this.props.data.action + '?' + this.props.data.args);

            } else if (this.props.data.action) {
                return this.createActionLink(this.props.data.action, this.props.data.args);
            }
            return undefined;
        },

        render : function () {
            return (
                <li>
                    <a href={this._createLink()} onClick={this.props.onClick}
                            target={this.props.data.openInBlank ? '_blank' : null}>
                        {this.props.data.label}
                        {this.props.data.indirect ? '\u2026' : null}
                    </a>
                </li>
            );
        }
    });


    // ----------------------------- <DisabledItem /> ----------------------

    const DisabledItem = React.createClass({

        mixins : mixins,

        render : function () {
            return (
                <span className="disabled">
                    {this.props.data.label}
                </span>
            );
        }
    });

    // ----------------------------- <EventTriggeringItem /> -----------------

    const EventTriggeringItem = React.createClass({

        mixins : mixins,

        _handleClick : function () {
            dispatcher.dispatch({
                actionType: this.props.data.message,
                props: this.props.data.args
            });
            this.props.closeActiveSubmenu();
        },

        render : function () {
            return (
                <li>
                    <a onClick={this._handleClick}>
                        {this.translate(this.props.data.label)}
                        {this.props.data.indirect ? '\u2026' : null}
                    </a>
                </li>
            );
        }
    });


    // ----------------------------- <SubMenu /> --------------------------

    const SubMenu = React.createClass({

        mixins : mixins,

        _createItem : function (item, key) {
            if (item.disabled) {
                return <DisabledItem key={key} data={item} />;

            } else if (item.message) {
                return <EventTriggeringItem key={key} data={item}
                            closeActiveSubmenu={this.props.closeActiveSubmenu} />;

            } else if (item.currConc) {
                return <ConcDependentItem key={key} data={item} />;

            } else {
                return <Item key={key} data={item} />;
            }
        },

        _renderSubmenu : function () {
            if (this.props.items.length > 0) {
                return (
                    <ul className="submenu">
                        {this.props.items.map((item, i) => this._createItem(item, i))}
                    </ul>
                );

            } else {
                return null;
            }
        },

        render : function () {
            const htmlClasses = [];

            if (this.props.isOpened) {
                htmlClasses.push('active');
            }
            if (this.props.items.length === 0 || this.props.isDisabled) {
                htmlClasses.push('disabled');
            }

            return (
                <li className={htmlClasses.join(' ')}
                        onMouseOver={this.props.handleMouseOver}
                        onMouseLeave={this.props.handleMouseOut}>
                    <a className="trigger"
                        title="">{this.props.label}</a>
                    {this.props.isOpened ? this._renderSubmenu() : null}
                </li>
            );
        }
    });

    // ----------------------------- <AsyncTaskList /> --------------------------

    const AsyncTaskList = React.createClass({

        mixins : mixins,

        getInitialState : function () {
            return {removeFinishedOnSubmit: true};
        },

        _handleButtonClick : function (evt) {
            if (this.state.removeFinishedOnSubmit) {
                dispatcher.dispatch({
                    actionType: 'INBOX_CLEAR_FINISHED_TASKS',
                    props: {}
                });
            }
            this.props.closeClickHandler(evt);
        },

        _handleCheckboxClick : function () {
            this.setState({removeFinishedOnSubmit: !this.state.removeFinishedOnSubmit});
        },

        render : function () {
            return (
                <layoutViews.ModalOverlay onCloseKey={this.props.closeClickHandler}>
                    <layoutViews.PopupBox onCloseClick={this.props.closeClickHandler} customClass="async-task-list">
                        <table>
                            <tbody>
                                <tr>
                                    <th>{this.translate('global__task_category')}</th>
                                    <th>{this.translate('global__task_label')}</th>
                                    <th>{this.translate('global__task_created')}</th>
                                    <th>{this.translate('global__task_status')}</th>
                                </tr>
                                {this.props.items.map(item => (
                                    <tr key={item.ident}>
                                        <td>{this.translate(`task__type_${item.category}`)}</td>
                                        <td>{item.label}</td>
                                        <td>{this.formatDate(new Date(item.created * 1000), 2)}</td>
                                        <td className="status">
                                            {this.translate(`task__status_${item.status}`)}
                                            {item.status === 'FAILURE' ?
                                                <img src={this.createStaticUrl('img/error-icon.svg')} alt={item.status} />
                                                : null }
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div>
                            <div className="options">
                                <label>
                                    <input type="checkbox" onChange={this._handleCheckboxClick}
                                            checked={this.state.removeFinishedOnSubmit} />
                                    {this.translate('global__remove_finished_tasks_info')}
                                </label>
                            </div>
                            <button type="button" className="default-button"
                                onClick={this._handleButtonClick}>{this.translate('global__close')}</button>
                        </div>
                    </layoutViews.PopupBox>
                </layoutViews.ModalOverlay>
            );
        }
    });

    // ----------------------------- <LiAsyncTaskNotificator /> --------------------------

    const LiAsyncTaskNotificator = React.createClass({

        mixins : mixins,

        _handleCloseClick : function () {
            this.setState({taskList: null});
        },

        _handleViewListClick : function () {
            this.setState({
                taskList: asyncTaskStore.getAsyncTasks()
            });
        },

        getInitialState : function () {
            return {
                taskList: null
            };
        },

        _renderHourglass : function () {
            if (this.props.numRunning > 0) {
                return <a title={this.translate('global__there_are_tasks_running_{num_tasks}', {num_tasks: this.props.numRunning})}>{'\u231B'}</a>;

            } else {
                return null;
            }
        },

        _renderEnvelope : function () {
            if (this.props.numFinished > 0) {
                return <a title={this.translate('global__there_are_tasks_finished_{num_tasks}', {num_tasks: this.props.numFinished})}>{'\u2709'}</a>;

            } else {
                return null;
            }
        },

        render : function () {
            if (this.props.numFinished > 0 || this.props.numRunning > 0) {
                return (
                    <li className="notifications">
                        <span onClick={this._handleViewListClick}>
                            {this._renderHourglass()}
                            {'\u00A0'}
                            {this._renderEnvelope()}
                        </span>
                        {this.state.taskList !== null ?
                            <AsyncTaskList items={this.state.taskList} closeClickHandler={this._handleCloseClick} />
                            : null}
                    </li>
                );

            } else {
                return null;
            }
        }
    });



    // ----------------------------- <MainMenu /> --------------------------

    const MainMenu = React.createClass({

        mixins : mixins,

        getInitialState : function () {
            return {
                currFocus: null,
                numRunningTasks: asyncTaskStore.getNumRunningTasks(),
                numFinishedTasks: asyncTaskStore.getNumFinishedTasks(),
                menuItems: mainMenuStore.getData()
            };
        },

        _handleHoverChange : function (ident, enable) {
            if (!enable) {
                this.setState(React.addons.update(this.state, {currFocus: {$set: null}}));

            } else {
                this.setState(React.addons.update(this.state, {currFocus: {$set: ident}}));
            }
        },

        _storeChangeListener : function (store, action) {
            this.setState({
                currFocus: this.state.currFocus,
                numRunningTasks: asyncTaskStore.getNumRunningTasks(),
                numFinishedTasks: asyncTaskStore.getNumFinishedTasks()
            });
        },

        componentDidMount : function () {
            asyncTaskStore.addChangeListener(this._storeChangeListener);
        },

        componentWillUnmount : function () {
            asyncTaskStore.removeChangeListener(this._storeChangeListener);
        },

        _closeActiveSubmenu : function () {
            this.setState(React.addons.update(this.state, {currFocus: {$set: null}}));
        },

        render : function () {
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

    });


    return {
        MainMenu: MainMenu
    }
}