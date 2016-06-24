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


/// <reference path="../../../ts/declarations/react.d.ts" />

import React from 'vendor/react';


export function init(dispatcher, mixins, lineStore) {

    let Line = React.createClass({
        render : function () {
            let primaryLang = this.props.data.languages.get(0);
            console.log('this.props.data: ', this.props.data);
            console.log('primaryLang: ', primaryLang);
            return (
                <tr data-toknum="267200" data-linegroup="_">
                    <td className="line-num">1</td>
                    <td className="manual-selection">
                        <input type="text" data-kwiclen="1" data-position="267200" data-linenum="0"
                            inputMode="numeric" style={{width: '1.4em'}} />
                    </td>
                    <td className="syntax-tree" style={{display: 'table-cell'}}>
                        <img src="" title="Click to see the syntax tree" />
                    </td>
                    <td className="ref" title="click to see details">
                        {primaryLang.ref}
                    </td>
                    <td className="lc ">
                        {primaryLang.left.map(item => item.text)}
                    </td>
                    <td className="kw " data-action="widectx" data-params="pos=267200&amp;hitlen=&amp;corpname=syn2010&amp;attrs=word&amp;attr_allpos=kw&amp;ctxattrs=word&amp;refs=%3Dopus.nazev">
                        {primaryLang.kwic.map(item => {
                            return <strong className={item.className}>{item.text}</strong>;
                        })}
                    </td>
                    <td className="rc ">
                        {primaryLang.right.map(item => item.text)}
                    </td>
                </tr>
            );
        }
    });

    let ConcLines = React.createClass({

        getInitialState : function () {
            return {lines: lineStore.getLines()};
        },

        render : function () {
            console.log('data: ', this.state.lines.toJS());
            return (
                <table id="conclines">
                    <tbody>
                        {this.state.lines.map(item => <Line key={item.toknum} data={item} />)}
                    </tbody>
                </table>
            );
        }
    });


    return {
        ConcLines: ConcLines
    }
}