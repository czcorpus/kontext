/*
 * Copyright (c) 2016 Institute of the Czech National Corpus
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

define(['vendor/react', 'jquery'], function (React, $) {
    'use strict';

    let lib = {};

    lib.init = function (dispatcher, mixins, lineSelectionStore) {

        let SimpleSelectionModeSwitch = React.createClass({
            mixins: mixins,

            _changeHandler : function (evt) {
                dispatcher.dispatch({
                    actionType: 'LINE_SELECTION_MODE_CHANGED',
                    props: {
                        mode: evt.target.value
                    }
                });
            },

            render : function () {
                return (
                    <select name="actions" defaultValue={this.props.initialAction}
                            onChange={this.props.switchHandler}>
                        <option value="-">--</option>
                        <option value="remove">{this.translate('global__remove_selected_lines')}</option>
                        <option value="remove_inverted">{this.translate('global__remove_all_but_selected_lines')}</option>
                        <option value="clear">{this.translate('global__clear_the_selection')}</option>
                        <option value="save">{this.translate('global__save_conc_line_selection')}</option>
                    </select>
                );
            }
        });

        let GroupsSelectionModelSwitch = React.createClass({
            mixins : mixins,

            _changeHandler : function (evt) {
                dispatcher.dispatch({
                    actionType: 'LINE_SELECTION_MODE_CHANGED',
                    props: {
                        mode: evt.target.value
                    }
                });
            },

            render : function () {
                return (
                    <select name="actions" defaultValue={this.props.initialAction}
                            onChange={this.props.switchHandler}>
                        <option value="-">--</option>
                        <option value="apply">{this.translate('global__apply_marked_lines')}</option>
                        <option value="apply_remove_rest">{this.translate('global__apply_marked_lines_remove_rest')}</option>
                        <option value="clear">{this.translate('global__clear_the_selection')}</option>
                        <option value="save">{this.translate('global__save_conc_line_selection')}</option>
                    </select>
                );
            }
        });

        let SaveDialog = React.createClass({

           mixins : mixins,

           render : function () {
               return (
                   <div>
                        <input type="text" onChange={this.props.inputChange} />
                        <button type="button" value="ok" onClick={this.props.buttonHandler}>{this.translate('global__ok')}</button>
                        <button type="button" value="cancel" onClick={this.props.buttonHandler}>{this.translate('global__cancel')}</button>
                   </div>
               );
           }

        });

        let LineSelectionMenu = React.createClass({

            mixins: mixins,

            _changeHandler : function (store, status) {
                if (status === 'STATUS_UPDATED') {
                    this.setState({mode: store.getMode(), saveDialog: this.state.saveDialog});
                }
            },

            _handleSaveDialogButton : function (evt) {
                if (evt.target.value === 'cancel') {
                    this.setState(React.addons.update(this.state, {saveDialog: {$set: false}}));

                } else if (evt.target.value === 'ok') {
                    dispatcher.dispatch({
                        actionType: 'LINE_SELECTION_SAVE_UNFINISHED',
                        props: {saveName: this.state.saveName}
                    });
                }
            },

            _actionChangeHandler : function (evt) {
                let actionMap = {
                    clear: 'LINE_SELECTION_RESET',
                    remove: 'LINE_SELECTION_REMOVE_LINES',
                    remove_inverted: 'LINE_SELECTION_REMOVE_OTHER_LINES',
                    apply: 'LINE_SELECTION_MARK_LINES',
                    apply_remove_rest: 'LINE_SELECTION_MARK_LINES_REMOVE_OTHERS'
                };
                let eventId = actionMap[evt.target.value] || null;

                if (eventId) {
                    dispatcher.dispatch({
                        actionType: eventId,
                        props: {}
                    });

                } else if (evt.target.value === 'save') {
                    this.setState(React.addons.update(this.state, {saveDialog: {$set: true}}));
                }
            },

            _handleSaveDialogNameChange : function (e) {
                this.setState(React.addons.update(this.state, {saveName: {$set: e.target.value}}));
            },

            getInitialState : function () {
                return {mode: 'simple', saveDialog: false, saveName: null};
            },

            componentDidMount : function () {
                lineSelectionStore.addChangeListener(this._changeHandler);
                dispatcher.dispatch({
                    actionType: 'LINE_SELECTION_STATUS_REQUEST',
                    props: {}
                });
            },

            componentWillUnmount : function () {
                lineSelectionStore.removeChangeListener(this._changeHandler);
            },

            componentDidUpdate : function () {
                // we must inform non-react environment (here popupbox.js) we are ready here
                if (typeof this.props.doneCallback === 'function') {
                    this.props.doneCallback();
                }
            },

            render : function () {
                let switchComponent = null;

                if (this.state.mode === 'simple') {
                    switchComponent = <SimpleSelectionModeSwitch initialAction="-"
                                        switchHandler={this._actionChangeHandler} />;

                } else if (this.state.mode === 'groups') {
                    switchComponent = <GroupsSelectionModelSwitch initialAction="-"
                                        switchHandler={this._actionChangeHandler} />;
                }

                if (this.state.saveDialog) {
                    return (
                        <div id="selection-actions">
                            <h3>...{this.translate('global__save_selection_heading')}</h3>
                            <SaveDialog buttonHandler={this._handleSaveDialogButton}
                                inputChange={this._handleSaveDialogNameChange} />
                        </div>
                    );

                } else {
                    return (
                        <div id="selection-actions">
                            <h3>{this.translate('global__selection_actions')}</h3>
                            <form action="delete_lines" method="POST">{switchComponent}</form>
                        </div>
                    );
                }
            }
        });

        return {
            LineSelectionMenu: LineSelectionMenu
        };
    };

    return lib;

});