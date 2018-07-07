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
import * as PDTVRD from './pdt-vallex';


export interface Views {
    VallexJsonRenderer:React.SFC<{data: VRD.VallexResponseData}>;
    PDTVallexJsonRenderer:React.SFC<{data: PDTVRD.PDTVallexResponseData}>;
}


export function init(dispatcher:ActionDispatcher, he:Kontext.ComponentHelpers) {



    // ------------- <PDTVallexJsonRenderer /> -------------------------------

    const PDTVallexJsonRenderer:Views['PDTVallexJsonRenderer'] = (props) => {
        if (props.data.result.length > 0) {
            return (
                <div className="VallexJsonRenderer">
                    <a className="toPDT" href={'http://lindat.mff.cuni.cz/services/PDT-Vallex/PDT-Vallex.html?verb=' + props.data.result[1][0][0]}>{props.data.result[1][0][0]}</a>
                    <PDTVerbList info={props.data.result[1][0]} />
                </div>
            );
        } else {
            return (
                <p>Nothing found</p>
            );
        }
    };

        // ------------- <PDTVerbList /> -------------------------------

    const PDTVerbList:React.SFC<{
        info:PDTVRD.VerbAndInfo;
    }> = (props) => {
        const renderVerbInfo = () => {
            return props.info[1].map((item, i) => {
                return <OneFrame key={i} id={item[0]}
                                info={item[1]} pdtEx={item[2]}
                                pcedtEx={item[3]}
                                verb={props.info[0]}/>
            });

        };
        return (
            <div>{renderVerbInfo()}</div>
        );
    };

        // ------------- <OneFrame /> -------------------------------

    const OneFrame:React.SFC<{
        key:any;
        id:PDTVRD.FrameID;
        info:PDTVRD.Info;
        pdtEx:PDTVRD.PDTExamples;
        pcedtEx:PDTVRD.PCEDTExamples;
        verb:string;
    }> = (props) => {

        return (
            <div>
                <div className="vallexSourceV">{props.verb}
                    {props.info[0].map((listValue, i) => {
                        if (listValue.length !== 0) {
                            return <span className="vallexFrame" key={i}>&nbsp;<span dangerouslySetInnerHTML={{__html: listValue}}/></span>;
                        }
                    })}
                </div>
                <ul className="vallexHiddenBullets">
                    {props.info[1].map((listValue, i) => {
                        if (listValue.length !== 0) {
                            return <li className="pdtvallexExpl" key={i}>{listValue}</li>;
                        }
                    })}
                </ul>
                <ul className="pdtvallexExamples">
                    {props.info[2].map((listValue, i) => {
                        if (listValue.length !== 0) {
                            return <li className="pdtvallexExamples" key={i}>{listValue}</li>;
                        }
                    })}
                </ul>
                <Examples pdtEx={props.pdtEx} pcedtEx={props.pcedtEx}/>
            </div>
        )
    };

    // ------------- <Examples /> -------------------------------

    class Examples extends React.Component<{
        pdtEx:PDTVRD.PDTExamples;
        pcedtEx:PDTVRD.PCEDTExamples;
    }, {collapse: boolean}> {

        constructor(props) {
            super(props);
            this.state = {collapse: true};
            this._clickHandler = this._clickHandler.bind(this);
        }

        _clickHandler() {
            this.setState({collapse: !this.state.collapse});
        }

        _textHandler() {
            return this.state.collapse ? "Show details" : "Hide details";
        }

        _getStateDisplay() {
            return this.state.collapse ? {display: 'none'} : {display: 'block'};
        }

        render() {
            return (
                <div>
                    <a className="vallexExpand" onClick={this._clickHandler}>{this._textHandler()}
                    </a>
                    <div className="PDTVallexExtra" style={this._getStateDisplay()}>

                        <ul className="PDTExamples">
                            <li className="ExamplesH">Examples from PDT</li>
                            {this.props.pdtEx.map((listValue, i) => {
                                if (listValue.length !== 0) {
                                return <li className="PDTExamples" key={i}>{listValue.toString().split(' ').slice(1).join(' ')}</li>;
                                }
                            })}
                        </ul>
                        <ul className="PCEDTExamples">
                            <li className="ExamplesH">Examples from PCEDT</li>
                            {this.props.pcedtEx.map((listValue, i) => {
                                if (listValue.length !== 0) {
                                return <li className="PCEDTExamples" key={i}>{listValue.toString().split(' ').slice(1).join(' ')}</li>;
                                }
                            })}
                        </ul>
                    </div>
                </div>
            );
        }
    }

    // ------------- <VallexJsonRenderer /> -------------------------------

    const VallexJsonRenderer:Views['VallexJsonRenderer'] = (props) => {
        if (props.data.result.length > 0) {
            return (
                <div className="VallexJsonRenderer">
                    <VerbList list={props.data.result[1]} language={props.data.inputParameters.language} />
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

    class TargetVerb extends React.Component<{
        verbSourceName:string;
        verbTargetName:string;
        verbSourceID:VRD.VsourceID;
        verbTargetList:VRD.VtargetInfo;
    }> {
        renderTargetVerbsInfo() {
            return this.props.verbTargetList.map((item, i) => {
                return <Target key={i} verbTargetName={this.props.verbTargetName}
                            verbSourceName={this.props.verbSourceName}
                            verbSourceID={this.props.verbSourceID}
                            verbTargetList={item} />
            });

        }

        render() {
            return (
                <div>{this.renderTargetVerbsInfo()}</div>
            );
        }
    };

    // ------------- <Target /> -------------------------------

    class Target extends React.Component<{
        verbSourceName:string;
        verbTargetName:string;
        verbSourceID:VRD.VsourceID;
        verbTargetList:VRD.VtargetInfo;
    }, {collapse: boolean}> {

        constructor(props) {
            super(props);
            this.state = {collapse: true};
            this._clickHandler = this._clickHandler.bind(this);
        }

        _clickHandler() {
            this.setState({collapse: !this.state.collapse});
        }

        _textHandler() {
            return this.state.collapse ? "Show details" : "Hide details";
        }

        _getStateDisplay() {
            return this.state.collapse ? {display: 'none'} : {display: 'block'};
        }

        render() {
            return (
                <div>
                    <a className="vallexExpand" onClick={this._clickHandler}>{this._textHandler()}
                    </a>
                    <div className="vallexTargetBlock" style={this._getStateDisplay()}>
                    <div className="vallexTargetV">{this.props.verbTargetName}
                        {this.props.verbTargetList[1][0].map((listValue, i) => {
                            if (listValue.length !== 0) {
                                return <span className="vallexFrame" key={i}>&nbsp;{listValue}</span>;
                            }
                        })}
                    </div>
                    <div className="vallexExplInner">{this.props.verbTargetList[1][1]}</div>
                    <ul>
                        {this.props.verbTargetList[1][2].map((listValue, i) => {
                            if (listValue.length !== 0) {
                                return <li key={i}>{listValue}</li>;
                            }
                        })}
                    </ul>
                    <div className="vallexFrameMap">
                        <p>{`Argument mapping for "${this.props.verbSourceName}" (${this.props.verbSourceID}) and "${this.props.verbTargetName}" (${this.props.verbTargetList[0]}):`}</p>
                    </div>
                    <ul className="vallexHiddenBullets">
                        {this.props.verbTargetList[2].map((listValue, i) => {
                            return <li className="" key={i}>{listValue[0]}&nbsp;{'\u2192'}&nbsp;{listValue[1]}</li>;

                        })}
                    </ul>
                </div>
                </div>
            );
        }
    }

    return {
        VallexJsonRenderer: VallexJsonRenderer,
        PDTVallexJsonRenderer: PDTVallexJsonRenderer
    }
}