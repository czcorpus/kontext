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
import * as Immutable from 'immutable';
import { ActionDispatcher } from '../../app/dispatcher';
import { Kontext } from '../../types/common';
import { MultiDict } from '../../util';


export interface Views {
    RawHtmlRenderer:React.SFC<{
        corpora: Immutable.List<string>;
        data: Array<[string, string]>;
    }>;
    DataMuseSimilarWords:React.SFC<{
        corpora: Immutable.List<string>;
        data:any;
    }>;
    TreqRenderer:React.SFC<{
        corpora: Immutable.List<string>;
        data:any;
    }>;
    UnsupportedRenderer:React.SFC<{
        corpora: Immutable.List<string>;
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
            <div className="provider-block">
                <strong className="base-word">{props.data.kwic}:</strong>
                <span className="words">
                    {props.data.contents.length > 0 ? '' : '\u2014'}
                    {props.data.contents.map((value, i) => {
                        return <React.Fragment key={value.word}>
                            <a className="word" href={he.createActionLink('first')}
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

    const TreqBacklinkForm:React.SFC<{
        action:string;
        args:Array<[string, string]>;

    }> = (props) => {
        return <form className="view-in-treq" action={props.action} method="post" target="_blank">
            {props.args.map(([k, v], i) =>
                <input key={`arg:${i}:${k}`} type="hidden" name={k} value={v} />
            )}
            <button type="submit" className="util-button">
                {he.translate('default_kwic_connect__view_in_treq')}
            </button>
        </form>;
    }

    const TreqRenderer:Views['TreqRenderer'] = (props) => {

        const generateLink = (word1, word2) => {
            const args = new MultiDict();
            args.set('corpname', props.data.contents.primary_corp);
            args.set('align', props.data.contents.translat_corp);
            args.set('maincorp', props.data.contents.primary_corp);
            args.set('queryselector', 'phraserow');
            args.set('phrase', word1);
            args.set('viewmode', 'align');
            args.set('queryselector_' + props.data.contents.translat_corp, 'phraserow');
            args.set('phrase_' + props.data.contents.translat_corp, word2);
            args.set('pcq_pos_neg_' + props.data.contents.translat_corp, 'pos');
            return he.createActionLink('first', args);
        };

        const renderWords = () => {
            const translations = props.data.contents['translations'];
            if (translations.length > 0) {
                return (
                    <span className="words">
                        {translations.length > 0 ? '' : '\u2014'}
                        {translations.map((translation, i) => (
                            <React.Fragment key={`${translation['righ']}:${i}`}>
                                <a className="word" href={generateLink(props.data.kwic, translation['righ'])}>{translation['righ']}</a>
                                {'\u00a0'}<span className="note">({translation['perc']})</span>
                                {i < props.data.contents.translations.length - 1 ? ', ' : null}
                            </React.Fragment>
                        ))}
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

    const UnsupportedRenderer:Views['UnsupportedRenderer'] = (props) => {
        return (
            <p>Unsupported renderer {props.data}</p>
        );
    };

    return {
        RawHtmlRenderer: RawHtmlRenderer,
        DataMuseSimilarWords: DataMuseSimilarWords,
        TreqRenderer: TreqRenderer,
        UnsupportedRenderer: UnsupportedRenderer
    };

}