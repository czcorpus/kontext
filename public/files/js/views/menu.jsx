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


export function init(dispatcher, mixins, concArgHandler, asyncTaskStore) {

    // ----------------------------- <ConcDependentItem /> --------------------------

    const ConcDependentItem = React.createClass({

        mixins : mixins,

        _createLink : function () {
            return this.createActionLink(this.props.data.action + '?' +
                    concArgHandler.exportConcArgs(this.props.data.args));
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
                return <EventTriggeringItem key={key} data={item} />;

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

    // ----------------------------- <LiInboxNotificator /> --------------------------

    const LiInboxNotificator = React.createClass({

        mixins : mixins,

        render : function () {
            if (this.props.numFinished > 0) {
                return (
                    <li>
                        <a title={this.translate('global__there_are_tasks_finished_{num_tasks}', {num_tasks: this.props.numFinished})}
                                onClick={this.props.clickHandler}>{'\uD83D\uDD82'}</a>
                    </li>
                );

            } else {
                return null;
            }
        }
    });

    // ----------------------------- <LiAsyncTaskNotificator /> --------------------------

    const LiAsyncTaskNotificator = React.createClass({

        mixins : mixins,

        render : function () {
            if (this.props.numRunning > 0) {
                return (
                    <li>
                        <a title={this.translate('global__there_are_tasks_running_{num_tasks}', {num_tasks: this.props.numRunning})}
                                onClick={this.props.clickHandler}>{'\u231B'}</a>
                    </li>
                );

            } else {
                return null;
            }
        }
    })

    // ----------------------------- <MainMenu /> --------------------------

    const MainMenu = React.createClass({

        mixins : mixins,

        getInitialState : function () {
            return {
                currFocus: null,
                numRunningTasks: asyncTaskStore.getNumRunningTasks(),
                numFinishedTasks: asyncTaskStore.getNumFinishedTasks()
            };
        },

        _handleHoverChange : function (ident, enable) {
            if (!enable) {
                this.setState({
                    currFocus: null,
                    numRunningTasks: this.state.numRunningTasks,
                    numFinishedTasks: this.state.numFinishedTasks
                });

            } else {
                this.setState({
                    currFocus: ident,
                    numRunningTasks: this.state.numRunningTasks,
                    numFinishedTasks: this.state.numFinishedTasks
                });
            }
        },

        _handleTaskListClick : function (type) {
            dispatcher.dispatch({
                actionType: 'INBOX_MESSAGE_LIST',
                props: {
                    type: type
                }
            });
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

        render : function () {
            return (
                <ul id="menu-level-1">
                    {this.props.submenuItems.map(item => {
                        const mouseOverHandler = item[1].disabled ? null : this._handleHoverChange.bind(this, item[0], true);
                        const mouseOutHandler = item[1].disabled ? null : this._handleHoverChange.bind(this, item[0], false);
                        return <SubMenu key={item[0]} label={item[1].label}
                                    items={item[1].items}
                                    isDisabled={item[1].disabled}
                                    isOpened={this.state.currFocus === item[0]}
                                    handleMouseOver={mouseOverHandler}
                                    handleMouseOut={mouseOutHandler} />;
                    })}
                    <LiAsyncTaskNotificator numRunning={this.state.numRunningTasks}
                            clickHandler={this._handleTaskListClick.bind(this, 'running')} />
                    <LiInboxNotificator numFinished={this.state.numFinishedTasks}
                            clickHandler={this._handleTaskListClick.bind(this, 'finished')} />
                </ul>
            );
        }

    });


    return {
        MainMenu: MainMenu
    }
}