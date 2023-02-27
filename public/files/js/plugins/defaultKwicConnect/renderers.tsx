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
import * as Kontext from '../../types/kontext';
import { IActionDispatcher } from 'kombo';
import { Dict, List, pipe, tuple } from 'cnc-tskit';
import { Actions as QueryActions } from '../../models/query/actions';
import { Actions as ConcActions } from '../../models/concordance/actions';
import { HighlightItem } from '../../models/concordance/main';
import { FreqDistType } from './model';
import * as TreqStyle from './treqStyle';


export interface Views {
    DisplayLinkRenderer:React.FC<{
        data: {link:string};
    }>;
    RawHtmlRenderer:React.FC<{
        corpora:Array<string>;
        data:{contents:Array<[string, string]>};
        concHighlightItems:Array<HighlightItem>;
        highlightedItems:{[item:string]:boolean}; // items hightlighted in kwic connect list
        freqType:FreqDistType;
    }>;
    DataMuseSimilarWords:React.FC<{
        corpora:Array<string>;
        data:any;
        concHighlightItems:Array<HighlightItem>;
        highlightedItems:{[item:string]:boolean}; // items hightlighted in kwic connect list
        freqType:FreqDistType;
    }>;
    TreqRenderer:React.FC<{
        corpora:Array<string>;
        data:any;
        concHighlightItems:Array<HighlightItem>;
        highlightedItems:{[item:string]:boolean}; // items hightlighted in kwic connect list
        freqType:FreqDistType;
    }>;
    UnsupportedRenderer:React.FC<{
        corpora:Array<string>;
        data:any;
        concHighlightItems:Array<HighlightItem>;
        highlightedItems:{[item:string]:boolean}; // items hightlighted in kwic connect list
        freqType:FreqDistType;
    }>;
    CustomMessageRenderer:React.FC<{
        corpora:Array<string>;
        data:any;
        concHighlightItems:Array<HighlightItem>;
        highlightedItems:{[item:string]:boolean}; // items hightlighted in kwic connect list
        freqType:FreqDistType;
    }>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers):Views {

    const DisplayLinkRenderer:Views['DisplayLinkRenderer'] = (props) => (
        <div>
            <a target="_blank" className="external" href={props.data.link}>
                {props.data.link}
            </a>
        </div>
    );

    const RawHtmlRenderer:Views['RawHtmlRenderer'] = (props) => {
        return (
            <div>
                {List.map((v, i) => <div key={`block:${i}`} dangerouslySetInnerHTML={{__html: v[1]}} />, props.data.contents)}
            </div>
        );
    };

    const DataMuseSimilarWords:Views['DataMuseSimilarWords'] = (props) => {
        // TODO check whether this works with the new submit system
        const generateLink = (word:string) => {
            return he.createActionLink('create_view',
            {
                corpname: props.corpora[0],
                q: `[word="(?i)${word}"]`
            });
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

    // ---------------------------------- <TreqRenderer /> ------------------------------------------

    const TreqRenderer:Views['TreqRenderer'] = (props) => {
        const [state, setState] = React.useState<{
            toggleAll:boolean;
            highlights:{[k:string]:boolean}
        }>({
            toggleAll: false,
            highlights: pipe(
                props.data.contents['translations'] as Array<{righ:string}>,
                List.map(item => tuple(item.righ, false)),
                Dict.fromEntries()
            )
        });

        const handleClick = (word:string) => () => {
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

        // handling concordance highlights only for first aligned corpus (level = 1)
        const handleConcHighlight = (evt:React.ChangeEvent<HTMLInputElement>) => {
            const highlights = {...state.highlights, [evt.target.value]: evt.target.checked};
            setState({...state, highlights});
            dispatcher.dispatch(
                ConcActions.SetHighlightItems,
                {
                    matchPosAttr: props.freqType as string,
                    items: pipe(
                        highlights,
                        Dict.toEntries(),
                        List.map(
                            ([value, checked]) => ({
                                level: 1,
                                checked,
                                value,
                                attr: props.freqType as string
                            })
                        )
                    )
                }
            );
        }

        const handleConcHighlightAll = (evt:React.ChangeEvent<HTMLInputElement>) => {
            const highlights = Dict.map(
                (v, k) => !state.toggleAll,
                state.highlights
            );
            setState({
                toggleAll: !state.toggleAll,
                highlights
            });
            dispatcher.dispatch(
                ConcActions.SetHighlightItems,
                {
                    matchPosAttr: props.freqType as string,
                    items: pipe(
                        highlights,
                        Dict.toEntries(),
                        List.map(
                            ([value, checked]) => ({
                                level: 1,
                                checked,
                                value
                            })
                        )
                    )
                }
            );
        }

        const renderWords = () => {
            const translations = props.data.contents['translations'];
            if (translations.length > 0) {
                return (
                    <div className="words">
                        {translations.length > 0 ? '' : '\u2014'}
                        {List.map((translation, i) => (
                            <span className="item" key={`${translation['righ']}:${i}`}>
                                <input type='checkbox' value={translation['righ']}
                                        checked={state.highlights[translation['righ']]} onChange={handleConcHighlight}/>
                                <a className={`word${props.highlightedItems[translation["righ"]] ?
                                                ' highlighted' : ' no-highlight'}`}
                                        onClick={handleClick(translation['righ'])}
                                        title={he.translate('default_kwic_connect__use_as_filter_in_2nd_corp')}>
                                    {translation['righ']}
                                </a>
                                <span className="note" title={he.translate('default_kwic_connect__abs_freq') + ': ' + translation['freq']}>
                                ({he.formatNumber(translation['perc'], 1)}%)
                                </span>
                                {i < props.data.contents.translations.length - 1 ?
                                    <span className="separ">, </span> :
                                    null
                                }
                            </span>
                        ), translations)}
                    </div>
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
            <TreqStyle.TreqContainer className="provider-block">
                <strong className="base-word">{props.data.kwic}:</strong>
                {renderWords()}
                <p>
                    <label>
                        {he.translate('default_kwic_connect__highlight_all_translations')}
                        <input type="checkbox" onChange={handleConcHighlightAll} checked={state.toggleAll} />
                    </label>
                </p>
                <TreqBacklinkForm action={backLink[0]} args={backLink[1]} />
            </TreqStyle.TreqContainer>
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
        DisplayLinkRenderer,
        RawHtmlRenderer,
        DataMuseSimilarWords,
        TreqRenderer,
        UnsupportedRenderer,
        CustomMessageRenderer
    };
}
