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
import { Kontext } from '../../types/common';
import { MultiDict } from '../../multidict';
import { IActionDispatcher } from 'kombo';
import { List, pipe } from 'cnc-tskit';
import { Actions as QueryActions } from '../../models/query/actions';


export interface Views {
    RawHtmlRenderer:React.FC<{
        corpora: Array<string>;
        data: {contents: Array<[string, string]>};
    }>;
    DataMuseSimilarWords:React.FC<{
        corpora: Array<string>;
        data:any;
    }>;
    TreqRenderer:React.FC<{
        corpora: Array<string>;
        data:any;
    }>;
    UnsupportedRenderer:React.FC<{
        corpora: Array<string>;
        data:any;
    }>;
    CustomMessageRenderer:React.FC<{
        corpora: Array<string>;
        data:any;
    }>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers):Views {

    const RawHtmlRenderer:Views['RawHtmlRenderer'] = (props) => {
        return (
            <div>
                {List.map((v, i) => <div key={`block:${i}`} dangerouslySetInnerHTML={{__html: v[1]}} />, props.data.contents)}
            </div>
        );
    };

    const DataMuseSimilarWords:Views['DataMuseSimilarWords'] = (props) => {
        const generateLink = (word:string) => {
            const args = new MultiDict();
            args.set('corpname', props.corpora[0]);
            pipe(
                props.corpora,
                List.tail(),
                List.forEach(
                    v => {
                        args.set('align', v);
                        // currently we have to ignore aligned kwics (the are not that easy to fetch)
                        // so we just set a key for query type and ignore the aligned query
                        args.set(`qtype_${v}`, 'simple');
                    }
                )
            );
            args.set('qtype', 'simple');
            args.set('query', word);
            return he.createActionLink('query_submit', args);
        };

        return (
            <div className="provider-block">
                <strong className="base-word">{props.data.kwic}:</strong>
                <span className="words">
                    {props.data.contents.length > 0 ? '' : '\u2014'}
                    {props.data.contents.map((value, i) => {
                        return <React.Fragment key={value.word}>
                            <a className="word" href={generateLink(value.word)}
                                    target="_blank" title={he.translate('global__search_link')}>
                                {value.word}
                            </a>
                            {i < props.data.contents.length - 1 ? ', ' : null}
                        </React.Fragment>
                    })}
                </span>
            </div>
        );
    };

    // --------------------------- TREQ -------------------------------------------------------

    const TreqBacklinkForm:React.FC<{
        action:string;
        args:Array<[string, string]>;

    }> = (props) => {
        return <form className="view-in-treq" action={props.action} method="post" target="_blank">
            {List.map(([k, v], i) =>
                <input key={`arg:${i}:${k}`} type="hidden" name={k} value={v} />,
                props.args
            )}
            <button type="submit" className="util-button">
                {he.translate('default_kwic_connect__view_in_treq')}
            </button>
        </form>;
    }

    const TreqRenderer:Views['TreqRenderer'] = (props) => {
        const handleClick = (word) => () => {
            dispatcher.dispatch<typeof QueryActions.QueryInputSetQuery>({
                name: QueryActions.QueryInputSetQuery.name,
                payload: {
                    formType: Kontext.ConcFormTypes.QUERY,
                    insertRange: null,
                    query: word,
                    rawAnchorIdx: 0,
                    rawFocusIdx: 0,
                    sourceId: props.data.contents.translat_corp
                }
            });
            dispatcher.dispatch<typeof QueryActions.QuerySubmit>({
                name: QueryActions.QuerySubmit.name
            });
        }

        const renderWords = () => {
            const translations = props.data.contents['translations'];
            if (translations.length > 0) {
                return (
                    <span className="words">
                        {translations.length > 0 ? '' : '\u2014'}
                        {List.map((translation, i) => (
                            <React.Fragment key={`${translation['righ']}:${i}`}>
                                <a className="word"
                                        onClick={handleClick(translation['righ'])}
                                        title={he.translate('default_kwic_connect__use_as_filter_in_2nd_corp')}>
                                    {translation['righ']}
                                </a>
                                {'\u00a0'}
                                <span className="note" title={he.translate('default_kwic_connect__abs_freq') + ': ' + translation['freq']}>
                                  ({he.formatNumber(translation['perc'], 1)}%)
                                </span>
                                {i < props.data.contents.translations.length - 1 ? ', ' : null}
                            </React.Fragment>
                        ), translations)}
                    </span>
                );

            } else {
                return (
                    <span className="words">
                        <span className="word not-found">&lt;{he.translate('default_kwic_connect__translation_not_found')}&gt;</span>
                    </span>
                );
            }
        };

        const backLink:[string, Array<[string, string]>] = props.data['contents']['treq_link'];

        return (
            <div className="provider-block">
                <strong className="base-word">{props.data.kwic}:</strong>
                {renderWords()}
                <TreqBacklinkForm action={backLink[0]} args={backLink[1]} />
            </div>
        );
    };

    // --------------------------- Unsupported renderer replacement --------------------------------------------------

    const UnsupportedRenderer:Views['UnsupportedRenderer'] = (props) => {
        return (
            <p>Unsupported renderer {props.data}</p>
        );
    };

    // --------------------------- A custom message passed instead of a configured renderer --------------------------------

    const CustomMessageRenderer:Views['CustomMessageRenderer'] = (props) => {
        return (
            <p>{props.data}</p>
        );
    };

    return {
        RawHtmlRenderer: RawHtmlRenderer,
        DataMuseSimilarWords: DataMuseSimilarWords,
        TreqRenderer: TreqRenderer,
        UnsupportedRenderer: UnsupportedRenderer,
        CustomMessageRenderer: CustomMessageRenderer
    };
}
