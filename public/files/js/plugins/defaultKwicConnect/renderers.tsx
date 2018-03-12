/*
 * Copyright (c) 2018 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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
import { ActionDispatcher } from '../../app/dispatcher';
import { Kontext } from '../../types/common';


export interface Views {
    RawHtmlRenderer:React.SFC<{
        data: Array<[string, string]>
    }>;
    DataMuseSimilarWords:React.SFC<{
        data:any
    }>;
    UnsupportedRenderer:React.SFC<{
        data:any;
    }>;
}


export function init(dispatcher:ActionDispatcher, he:Kontext.ComponentHelpers):Views {

    const RawHtmlRenderer:Views['RawHtmlRenderer'] = (props) => {
        return (
            <div>
                {props.data.map((v, i) => <div key={`block:${i}`} dangerouslySetInnerHTML={{__html: v[1]}} />)}
            </div>
        );
    };

    const DataMuseSimilarWords:Views['DataMuseSimilarWords'] = (props) => {
        return (
            <p className="keywords">
                <strong>{props.data.kwic}</strong>:{'\u00a0'}
                {props.data.contents.map((value, i) => {
                    return <React.Fragment key={value.word}>
                        <a className="keyword" href={he.createActionLink('first')}
                                target="_blank" title={he.translate('global__search_link')}>
                            {value.word}
                        </a>
                        {i < props.data.contents.length - 1 ? ', ' : null}
                    </React.Fragment>
                })}
            </p>
        );
    };

    const UnsupportedRenderer:Views['UnsupportedRenderer'] = (props) => {
        return (
            <p>Unsupported renderer {props.data}</p>
        );
    };

    return {
        RawHtmlRenderer: RawHtmlRenderer,
        DataMuseSimilarWords: DataMuseSimilarWords,
        UnsupportedRenderer: UnsupportedRenderer
    };

}