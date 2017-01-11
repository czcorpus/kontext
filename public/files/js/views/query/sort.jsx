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


export function init(dispatcher, mixins, sortStore, multiLevelSortStore) {

    // -------------------------- <AttributeList /> ---------------------------------

    const AttributeList = React.createClass({

        render : function () { // TODO
            return (
                <select name="sattr" id="select">
                    {this.props.availAttrs.map(item => <option value={item.n}>{item.label}</option>)}
                </select>
            );
        }
    });

     // -------------------------- <TRSortingKey /> ---------------------------------

    const TRSortingKey = React.createClass({

        mixins : mixins,

        _selectionHandler : function (evt) {
            console.log('handle change ', evt.target.value); // TODO
        },

        render : function () {
            return (
                <tr>
                    <th>Sort key:</th>
                    <td>
                        <label>
                            <input type="radio" name="skey" value="lc" onChange={this._selectionHandler} />
                            Left context
                        </label>
                        <label>
                            <input type="radio" name="skey" value="kw" onChange={this._selectionHandler}/>
                            Node
                        </label>
                        <label>
                            <input type="radio" name="skey" value="rc" onChange={this._selectionHandler} />
                            Right context
                        </label>
                    </td>
                </tr>
            );
        }
    })

    // -------------------------- <SimpleSortForm /> ---------------------------------

    const SimpleSortForm = React.createClass({

        mixins : mixins,

        _handleNumTokens : function (evt) {
            console.log('num tokens: ', evt.target.value); // TODO
        },

        render : function () {
            return (
                <form action="sortx">
                    <fieldset>
                        <table className="form">
                            <tbody>
                                <tr>
                                    <th>Attribute:</th>
                                    <td>
                                        <AttributeList availAttrs={this.props.availAttrs} />
                                    </td>
                                </tr>
                                <TRSortingKey />
                                <tr>
                                    <th>Number of tokens to sort:</th>
                                    <td>
                                        <input type="text" name="spos" style={{width: '2em'}} onChange={this._handleNumTokens} />
                                    </td>
                                </tr>
                                <tr>
                                    <th>
                                        <label htmlFor="sicase_checkbox">Ignore case:</label>
                                    </th>
                                    <td>
                                        <input id="sicase_checkbox" type="checkbox" name="sicase" value="i" />
                                    </td>
                                </tr>
                                <tr>
                                    <th>
                                        <label htmlFor="sbward_checkbox">Backward</label>
                                        <a className="backward-sort-help context-help">
                                            <img className="over-img" src="/files/img/question-mark.svg" />
                                        </a>:
                                    </th>
                                    <td>
                                        <input id="sbward_checkbox" type="checkbox" name="sbward" value="r" />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <div className="buttons">
                            <input type="submit" className="default-button" value="Sort Concordance" />
                        </div>
                    </fieldset>
                </form>
            );
        }
    });

    // -------------------------- <SortForm /> ---------------------------------

    const SortForm = React.createClass({

        mixins : mixins,

        getInitialState : function () {
            return {
                availAttrs: sortStore.getAvailAttrs()
            }
        },

        render : function () {
            return (
                <div>
                    <SimpleSortForm availAttrs={this.state.availAttrs} />
                </div>
            );
        }
    });

    return {
        SortFormView: SortForm
    };
}