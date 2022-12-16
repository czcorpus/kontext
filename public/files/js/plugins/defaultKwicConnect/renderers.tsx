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
import { List, pipe } from 'cnc-tskit';
import { Actions as QueryActions } from '../../models/query/actions';
import { Actions as ConcActions } from '../../models/concordance/actions';
import { HighlightItem } from '../../models/concordance/main';
import { FreqDistType } from './model';


export interface Views {
    DisplayLinkRenderer:React.FC<{
        data: {link: string};
    }>;
    RawHtmlRenderer:React.FC<{
        corpora: Array<string>;
        data: {contents: Array<[string, string]>};
        highlightItems: Array<HighlightItem>;
        freqType: FreqDistType;
    }>;
    DataMuseSimilarWords:React.FC<{
        corpora: Array<string>;
        data:any;
        highlightItems: Array<HighlightItem>;
        freqType: FreqDistType;
    }>;
    TreqRenderer:React.FC<{
        corpora: Array<string>;
        data:any;
        highlightItems: Array<HighlightItem>;
        freqType: FreqDistType;
    }>;
    UnsupportedRenderer:React.FC<{
        corpora: Array<string>;
        data:any;
        highlightItems: Array<HighlightItem>;
        freqType: FreqDistType;
    }>;
    CustomMessageRenderer:React.FC<{
        corpora: Array<string>;
        data:any;
        highlightItems: Array<HighlightItem>;
        freqType: FreqDistType;
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

        const [toggleAllOn, setToggleAll] = React.useState(false);

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

        // handling highlights only for first aligned corpus (level = 1)
        const handleHighlight = (evt:React.ChangeEvent<HTMLInputElement>) => {
            if (evt.target.checked) {
                dispatcher.dispatch(
                    ConcActions.SetHighlightItems,
                    {
                        matchPosAttr: props.freqType as string,
                        items: List.push({value: evt.target.value, level: 1}, [...props.highlightItems])
                    }
                );

            } else {
                const items = List.filter(v => !(v.level === 1 && v.value === evt.target.value), [...props.highlightItems]);
                if (List.empty(items)) {
                    setToggleAll(false);
                }
                dispatcher.dispatch(
                    ConcActions.SetHighlightItems,
                    {
                        matchPosAttr: props.freqType as string,
                        items
                    }
                );
            }
        }

        const handleHighlightAll = (evt:React.ChangeEvent<HTMLInputElement>) => {
            setToggleAll(!toggleAllOn);

            const translations:Array<{freq:number; perc:number; left:string; righ:string}> = props.data.contents['translations'];
            dispatcher.dispatch(
                ConcActions.SetHighlightItems,
                {
                    matchPosAttr: props.freqType as string,
                    items: evt.target.checked ?
                        pipe(
                            translations,
                            List.map(
                                v => ({value: v.righ, level: 1})
                            )
                        ) :
                        []
                }
            );
        }

        const _isHighlighted = (value:string):boolean => {
            return List.some(v => v.level === 1 && v.value === value, props.highlightItems);
        }

        const renderWords = () => {
            const translations = props.data.contents['translations'];
            if (translations.length > 0) {
                return (
                    <span className="words">
                        {translations.length > 0 ? '' : '\u2014'}
                        {List.map((translation, i) => (
                            <React.Fragment key={`${translation['righ']}:${i}`}>
                                <input type='checkbox' value={translation['righ']} checked={_isHighlighted(translation['righ'])} onChange={handleHighlight}/>
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
                <p>
                    <label>
                        {he.translate('default_kwic_connect__highlight_all_translations')}
                        <input type="checkbox" onChange={handleHighlightAll} checked={toggleAllOn} />
                    </label>
                </p>
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
        DisplayLinkRenderer,
        RawHtmlRenderer,
        DataMuseSimilarWords,
        TreqRenderer,
        UnsupportedRenderer,
        CustomMessageRenderer
    };
}
