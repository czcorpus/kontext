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
import * as Kontext from '../../../types/kontext';
import { MultiDict } from '../../../multidict';
import { IActionDispatcher } from 'kombo';
import { init as ftInit, FormattedTextRendererProps } from './formattedText';


export interface Views {
    RawHtmlRenderer:React.FC<{data: Array<[string, string]>}>;
    SimpleTabularRenderer:React.FC<{data: Array<Array<[string, string]>>}>;
    DescriptionListRenderer:React.FC<{data: Array<[string, string]>}>;
    UnsupportedRenderer:React.FC<{data: any}>;
    DataMuseSimilarWords:React.FC<{
        corpname:string;
        data:Array<{
            word:string;
            score:number;
            tags:Array<string>;
        }>;
    }>;
    ErrorRenderer:React.FC<{
        data:{
            error:string;
        }
    }>;
    FormattedTextRenderer:React.FC<FormattedTextRendererProps>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers) {

    const layoutViews = he.getLayoutViews();
    const FormattedTextRenderer = ftInit(he);

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
            <layoutViews.UnsupportedRenderer>
                <p className="note"><strong>{he.translate('defaultTD__unsupported_renderer')}</strong></p>
                <p className="data-label">{he.translate('defaultTD__original_data')}:</p>
                <pre>{JSON.stringify(props.data)}</pre>
            </layoutViews.UnsupportedRenderer>
        );
    };

    // ------------- <DataMuseSimilarWords /> -------------------------------

    const DataMuseSimilarWords:Views['DataMuseSimilarWords'] = (props) => {
        return (
            <p className="keywords">
                {props.data.map((value, i) => {
                    const args = new MultiDict();
                    args.set('corpname', props.corpname);
                    args.set('qtype', 'simple');
                    args.set('query', value.word);

                    return <React.Fragment key={value.word}>
                        <a className="keyword" href={he.createActionLink('query_submit', args)}
                                target="_blank" title={he.translate('global__search_link')}>
                            {value.word}
                        </a>
                        {i < props.data.length - 1 ? ', ' : null}
                    </React.Fragment>
                })}
            </p>
        );
    };

    // ------------- <ErrorRenderer /> -------------------------------

    const ErrorRenderer:Views['ErrorRenderer'] = (props) => {
        return <div className="ErrorRenderer">
            <p>
                <img className="error-icon"
                        src={he.createStaticUrl('img/error-icon.svg')}
                        alt={he.translate('global__error_icon')} />
                {he.translate('defaultTD__failed_to_fetch_external_information')}.

            </p>
            <p className="gear">
                <img src={he.createStaticUrl('img/gear.svg')} alt={he.translate('defaultTD__plug_in_error_symbol_alt')}
                        style={{width: '3em'}} title={props.data.error} />
            </p>
        </div>
    };

    return {
        RawHtmlRenderer,
        SimpleTabularRenderer,
        DescriptionListRenderer,
        UnsupportedRenderer,
        DataMuseSimilarWords,
        ErrorRenderer,
        FormattedTextRenderer
    };

}