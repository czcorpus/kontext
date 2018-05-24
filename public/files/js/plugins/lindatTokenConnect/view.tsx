/*
 * Copyright (c) 2018 Kira Droganova
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
import * as VRD from './vallex';
import { Button } from './vendor/reactstrap';


export interface Views {
    VallexJsonRenderer:React.SFC<{data: VRD.VallexResponseData}>;
}


export function init(dispatcher:ActionDispatcher, he:Kontext.ComponentHelpers) {


    // ------------- <VallexJsonRenderer /> -------------------------------

    const VallexJsonRenderer:Views['VallexJsonRenderer'] = (props) => {
        if (props.data.result.length > 0) {
            return (
                <div className="VallexJsonRenderer">
                    <VerbList list={props.data.result[1]} language={props.data.inputParameters.language} />
                    <Button>OK</Button>
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
        language:string;
    }> = (props) => {
        const renderVerbInfo = () => {
            return props.list.map((item, i) => {
                return <Pair language={props.language} key={i} name={item[0]} detail={item[1]} />
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
        language:string;
    }> = (props) => {

        const toVallex = (props) => {
            const TargetVallex = props.name.split(' : ')[0];
            if (props.language == 'cz') {
                const fullLink = 'https://lindat.mff.cuni.cz/services/CzEngVallex/CzEngVallex.html?vlanguage=cz&block=D&first_verb=' + TargetVallex + '&second_verb=ALL';
                return fullLink
            } else {
                const fullLink = 'https://lindat.mff.cuni.cz/services/CzEngVallex/CzEngVallex.html?vlanguage=en&block=D&first_verb=' + TargetVallex + '&second_verb=ALL';
                return fullLink
            }
        };

        return (
            <div>
                <a className="vallexSense" href={toVallex(props)}>{props.name}</a>
                <div className="vallexSourceV">{props.name.split(' : ')[0]}
                    {props.detail[0][1][0].map((listValue, i) => {
                        if (listValue.length !== 0) {
                            return <span className="vallexFrame" key={i}>&nbsp;<span dangerouslySetInnerHTML={{__html: listValue}}/></span>;
                        }
                    })}
                </div>

                <div className="vallexExpl">{props.detail[0][1][1]}</div>
                <ul className="vallexExamples">
                    {props.detail[0][1][2].map((listValue, i) => {
                        if (listValue.length !== 0) {
                            return <li className="vallexExamples" key={i}>{listValue}</li>;
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
            <div className="vallexTargetBlock">
                <div className="vallexTargetV">{props.verbTargetName}
                    {props.verbTargetList[1][0].map((listValue, i) => {
                        if (listValue.length !== 0) {
                            return <span className="vallexFrame"  key={i}>&nbsp;{listValue}</span>;
                        }
                    })}
                </div>
                <div className="vallexExplInner">{props.verbTargetList[1][1]}</div>
                <ul>
                    {props.verbTargetList[1][2].map((listValue, i) => {
                        if (listValue.length !== 0) {
                            return <li key={i}>{listValue}</li>;
                        }
                    })}
                </ul>
                <div className="vallexFrameMap"><p>{`Argument mapping for "${props.verbSourceName}" (${props.verbSourceID}) and "${props.verbTargetName}" (${props.verbTargetList[0]}):`}</p></div>
                <ul className="vallexHiddenBullets">
                    {props.verbTargetList[2].map((listValue, i) => {
                        return <li className="" key={i}>{listValue[0]}&nbsp;{'\u2192'}&nbsp;{listValue[1]}</li>;

                    })}
                </ul>
            </div>
        )
    };

    return {
        VallexJsonRenderer: VallexJsonRenderer
    }
}