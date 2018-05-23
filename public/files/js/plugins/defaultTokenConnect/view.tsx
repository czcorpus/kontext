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
import * as VRD from './valex';


export interface Views {
    RawHtmlRenderer:React.SFC<{data: Array<[string, string]>}>;
    ValexJsonRenderer:React.SFC<{data: VRD.ValexResponseData}>;
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
                <p className="note"><strong>{he.translate('defaultTD__unsupported_renderer')}</strong></p>
                <p className="data-label">{he.translate('defaultTD__original_data')}:</p>
                <pre>{JSON.stringify(props.data)}</pre>
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

    // ------------- <ValexJsonRenderer /> -------------------------------

    const ValexJsonRenderer:Views['ValexJsonRenderer'] = (props) => {
        if (props.data.result.length > 0) {
            return (
                <div className="ValexJsonRenderer">
                    <VerbList list={props.data.result[1]} />
                </div>
            );
        } else {
            return (
                <p>Nothing found</p>
            );
        }
    };

    // ------------- <VerbList /> -------------------------------

    const VerbList:React.SFC<{
        list:VRD.CompleteSenseList;
    }> = (props) => {
        const renderVerbInfo = () => {
            return props.list.map((item, i) => {
                return <Pair key={i} name={item[0]} detail={item[1]} />
            });

        };
        return (
            <div>{renderVerbInfo()}</div>
        );
    };

    // ------------- <Pair /> -------------------------------

    const Pair:React.SFC<{
        key:any;
        name:VRD.Sense;
        detail:VRD.SenseInfoList;
    }> = (props) => {

        const toPDTVallex = (props) => {
            console.log('Hi!')
        };

        return (
            <div>
                <div className="valexSense" onClick={toPDTVallex}>{props.name}</div>
                <div className="valexSourceV">{props.name.split(' : ')[0]}
                    {props.detail[0][1][0].map((listValue, i) => {
                        if (listValue.length !== 0) {
                            return <span className="valexFrame" key={i}>&nbsp;{listValue}</span>;
                        }
                    })}
                </div>

                <div className="valexExpl">{props.detail[0][1][1]}</div>
                <ul className="valexExamples">
                    {props.detail[0][1][2].map((listValue, i) => {
                        if (listValue.length !== 0) {
                            return <li className="valexExamples" key={i}>{listValue}</li>;
                        }
                    })}
                </ul>
                <TargetVerb verbSourceName={props.name.split(' : ')[0]}
                            verbTargetName={props.name.split(' : ')[1]}
                            verbSourceID={props.detail[0][0]}
                            verbTargetList={props.detail[0][2]}/>
            </div>

        )
    };

    // ------------- <TargetVerb /> -------------------------------

    const TargetVerb:React.SFC<{
        verbSourceName:string;
        verbTargetName:string;
        verbSourceID:VRD.VsourceID;
        verbTargetList:VRD.VtargetInfo;
    }> = (props) => {
        const renderTargetVerbsInfo = () => {
            return props.verbTargetList.map((item, i) => {
                return <Target key={i} verbTargetName={props.verbTargetName}
                               verbSourceName={props.verbSourceName}
                               verbSourceID={props.verbSourceID}
                               verbTargetList={item} />
            });

        };
        return (
            <div>{renderTargetVerbsInfo()}</div>
        );
    };

    // ------------- <Target /> -------------------------------

    const Target:React.SFC<{
        verbSourceName:string;
        verbTargetName:string;
        verbSourceID:VRD.VsourceID;
        verbTargetList:VRD.VtargetInfo;
    }> = (props) => {
        return (
            <div className="valexTargetBlock">
                <div className="valexTargetV">{props.verbTargetName}
                    {props.verbTargetList[1][0].map((listValue, i) => {
                        if (listValue.length !== 0) {
                            return <span className="valexFrame"  key={i}>&nbsp;{listValue}</span>;
                        }
                    })}
                </div>
                <div className="valexExplInner">{props.verbTargetList[1][1]}</div>
                <ul>
                    {props.verbTargetList[1][2].map((listValue, i) => {
                        if (listValue.length !== 0) {
                            return <li key={i}>{listValue}</li>;
                        }
                    })}
                </ul>
                <div className="valexFrameMap"><p>{`Argument mapping for "${props.verbSourceName}" (${props.verbSourceID}) and "${props.verbTargetName}" (${props.verbTargetList[0]}):`}</p></div>
                <ul className="valexHiddenBullets">
                    {props.verbTargetList[2].map((listValue, i) => {
                        return <li className="" key={i}>{listValue[0]}&nbsp;{'\u2192'}&nbsp;{listValue[1]}</li>;

                    })}
                </ul>
            </div>
        )
    };


    return {
        RawHtmlRenderer: RawHtmlRenderer,
        SimpleTabularRenderer: SimpleTabularRenderer,
        DescriptionListRenderer: DescriptionListRenderer,
        UnsupportedRenderer: UnsupportedRenderer,
        DataMuseSimilarWords: DataMuseSimilarWords,
        ValexJsonRenderer: ValexJsonRenderer
    };

}