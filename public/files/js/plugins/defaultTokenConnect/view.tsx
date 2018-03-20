/*
 * Copyright (c) 2017 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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
import * as Immutable from 'immutable';
import {ActionDispatcher} from '../../app/dispatcher';
import {Kontext} from '../../types/common';
import {PluginInterfaces} from '../../types/plugins';
import {MultiDict} from '../../util';


export interface Views {
    RawHtmlRenderer:React.SFC<{data: Array<[string, string]>}>;
    SimpleTabularRenderer:React.SFC<{data: Array<Array<[string, string]>>}>;
    DescriptionListRenderer:React.SFC<{data: Array<[string, string]>}>;
    UnsupportedRenderer:React.SFC<{data: any}>;
    DataMuseSimilarWords:React.SFC<{
        corpname:string;
        data:Array<{
            word:string;
            score:number;
            tags:Array<string>;
        }>;
    }>;
}


export function init(dispatcher:ActionDispatcher, he:Kontext.ComponentHelpers) {

    // ------------- <RawHtmlRenderer /> -------------------------------

    const RawHtmlRenderer:Views['RawHtmlRenderer'] = (props) => {
        return (
            <div>
                {props.data.map((v, i) => <div key={`block:${i}`} dangerouslySetInnerHTML={{__html: v[1]}} />)}
            </div>
        );
    };

    // ------------- <SimpleTabularRenderer /> -------------------------------

    const SimpleTabularRenderer:Views['SimpleTabularRenderer'] = (props) => {
        return (
            <table>
                <tbody>
                    {props.data.map((item, i) => (
                        <tr key={`block:${i}`}>
                            <th>{item[0]}</th>
                            <th>{item[1]}</th>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    // ------------- <DescriptionListRenderer /> -------------------------------

    const DescriptionListRenderer:Views['DescriptionListRenderer'] = (props) => {
        return (
            <dl>
                {props.data.map(item => [
                    <dt key="dt">{item[0]}</dt>,
                    <dd key="dd">{item[1]}</dd>
                ])}
            </dl>
        );
    };

    // ------------- <UnsupportedRenderer /> -------------------------------

    const UnsupportedRenderer:Views['UnsupportedRenderer'] = (props) => {
        return (
            <div className="UnsupportedRenderer">
                <p><strong>{he.translate('defaultTD__unsupported_renderer')}</strong></p>
                <p>{he.translate('defaultTD__original_data')}:</p>
                <pre>{JSON.stringify(window)}</pre>
            </div>
        );
    };

    // ------------- <DataMuseSimilarWords /> -------------------------------

    const DataMuseSimilarWords:Views['DataMuseSimilarWords'] = (props) => {
        return (
            <p className="keywords">
                {props.data.map((value, i) => {
                    const args = new MultiDict();
                    args.set('corpname', props.corpname);
                    args.set('queryselector', 'phraserow');
                    args.set('phrase', value.word);

                    return <React.Fragment key={value.word}>
                        <a className="keyword" href={he.createActionLink('first', args)}
                                target="_blank" title={he.translate('global__search_link')}>
                            {value.word}
                        </a>
                        {i < props.data.length - 1 ? ', ' : null}
                    </React.Fragment>
                })}
            </p>
        );
    };

    return {
        RawHtmlRenderer: RawHtmlRenderer,
        SimpleTabularRenderer: SimpleTabularRenderer,
        DescriptionListRenderer: DescriptionListRenderer,
        UnsupportedRenderer: UnsupportedRenderer,
        DataMuseSimilarWords: DataMuseSimilarWords
    };

}