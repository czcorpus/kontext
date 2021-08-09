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
import * as Kontext from '../../types/kontext';
import * as VRD from './vallex';
import * as PDTVRD from './pdt-vallex';
import * as ENGVRD from './eng-vallex';
import { IActionDispatcher } from 'kombo';

import * as S from './style';


export interface Views {
    VallexJsonRenderer:React.FC<{data: VRD.VallexResponseData}>;
    PDTVallexJsonRenderer:React.FC<{data: PDTVRD.PDTVallexResponseData}>;
    EngVallexJsonRenderer:React.FC<{data: ENGVRD.EngVallexResponseData}>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers) {


        // ------------- <EngVallexJsonRenderer /> -------------------------------

    const EngVallexJsonRenderer:Views['EngVallexJsonRenderer'] = (props) => {
        if (props.data.result.length > 0) {
            return (
                <S.VallexJsonRenderer className="1">
                    <a className="vallexSense" href={'http://lindat.mff.cuni.cz/services/PDT-Vallex/EngVallex.html?verb=' + props.data.result[1][0][0]} target="_blank">{props.data.result[1][0][0]}</a>
                    <EngVerbList info={props.data.result[1][0]} />
                </S.VallexJsonRenderer>
            );
        } else {
            return (
                <p>No match found in dictionaries.</p>
            );
        }
    };

    // ------------- <EngVerbList /> -------------------------------

    class EngVerbList extends React.Component<{
        info:ENGVRD.VerbAndInfo;
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
            return this.state.collapse ? "Show more" : "Show less";
        }

        _renderEngVerbInfo() {
            if (this.state.collapse) {
                return this.props.info[1].slice(0, 1).map((item, i) => {
                    return <OneEngFrame key={i} id={item[0]}
                                        info={item[1]}
                                        pcedtEx={item[2]}
                                        verb={this.props.info[0]}/>
                });
            }
            return this.props.info[1].map((item, i) => {
                return <OneEngFrame key={i} id={item[0]}
                                info={item[1]}
                                pcedtEx={item[2]}
                                verb={this.props.info[0]}/>
            });
        }

        _renderToggle() {
            if (this.props.info[1].length > 1) {
                return <a className="EngVerbListExpand" onClick={this._clickHandler}>{this._textHandler()}</a>
            }
            return ""
        }

        render() {
            return (
                <div>
                    <div className="containerTC">{this._renderEngVerbInfo()}</div>
                    <div>{this._renderToggle()}</div>
                </div>
            );
        }
    };

        // ------------- <OneEngFrame /> -------------------------------

    const OneEngFrame:React.SFC<{
        key:any;
        id:ENGVRD.FrameID;
        info:ENGVRD.Info;
        pcedtEx:ENGVRD.PCEDTExamples;
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
                <EngExamples pcedtEx={props.pcedtEx}/>
            </div>
        )
    };

    // ------------- <Examples /> -------------------------------

    class EngExamples extends React.Component<{
        pcedtEx:ENGVRD.PCEDTExamples;
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
            return this.state.collapse ? "Show examples" : "Hide examples";
        }

        _getStateDisplay() {
            return this.state.collapse ? {display: 'none'} : {display: 'block'};
        }

        _getStateDisplayExamples() {
            if ( this.props.pcedtEx.length === 0) {
                return {display: 'none'}
            } else {
                return {display: 'block'}
            }
        }

        render() {
            return (
                <div>
                    <a className="vallexExpand" style={this._getStateDisplayExamples()} onClick={this._clickHandler}>{this._textHandler()}
                    </a>
                    <div className="PDTVallexExtra" style={this._getStateDisplay()}>
                        <ul className="PCEDTExamples" style={this._getStateDisplayExamples()}>
                            <li className="ExamplesH">Examples from PCEDT</li>
                            {this.props.pcedtEx.map((listValue, i) => {
                                if (listValue.length !== 0)
                                {return <li className="PCEDTExamples" key={i}>{listValue.toString().split(' ').slice(1).join(' ')}</li>;
                                }
                            })}
                        </ul>
                    </div>
                </div>
            );
        }
    }


    // ------------- <PDTVallexJsonRenderer /> -------------------------------

    const PDTVallexJsonRenderer:Views['PDTVallexJsonRenderer'] = (props) => {
        if (props.data.result.length > 0) {
            return (
                <S.VallexJsonRenderer className="2">
                    <PDTVerbList info={props.data.result[1][0]} />
                </S.VallexJsonRenderer>
            );
        } else {
            return (
                <p>No match found in dictionaries.</p>
            );
        }
    };

        // ------------- <PDTVerbList /> -------------------------------

    class PDTVerbList extends React.Component <{
        info:PDTVRD.VerbAndInfo;
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
            return this.state.collapse ? "Show more" : "Show less";
        }

        _renderVerbInfo() {
            if (this.state.collapse) {
                return this.props.info[1].slice(0, 1).map((item, i) => {
                    return <OneFrame key={i} id={item[0]}
                                    info={item[1]} pdtEx={item[2]}
                                    pcedtEx={item[3]}
                                    verb={this.props.info[0]}/>
            });
            }
            return this.props.info[1].map((item, i) => {
                return <OneFrame key={i} id={item[0]}
                                info={item[1]} pdtEx={item[2]}
                                pcedtEx={item[3]}
                                verb={this.props.info[0]}/>
            });
        }

        _renderToggle() {
            if (this.props.info[1].length > 1) {
                return <a className="PDTVerbListExpand" onClick={this._clickHandler}>{this._textHandler()}</a>
            }
            return ""
        }

        render() {
            return (
                <div>
                    <div className="containerTC">{this._renderVerbInfo()}</div>
                    <div>{this._renderToggle()}</div>
                </div>
            );
        }
    };

        // ------------- <OneFrame /> -------------------------------

    const OneFrame:React.FC<{
        key:any;
        id:PDTVRD.FrameID;
        info:PDTVRD.Info;
        pdtEx:PDTVRD.PDTExamples;
        pcedtEx:PDTVRD.PCEDTExamples;
        verb:string;
    }> = (props) => {

        return (
            <div>
                <div className="vallexSourceV">
                    <div className="vallexSum2">
                    <span className="vallexSense">{props.verb}</span>
                    <div className="forVLink2">
                    <a className="vallexSense" href={'http://lindat.mff.cuni.cz/services/PDT-Vallex/PDT-Vallex.html?verb=' + props.verb + '#' + props.id} target="_blank">Open in PDT-Vallex</a>
                    </div>
                    </div>
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
            return this.state.collapse ? "Show examples" : "Hide examples";
        }

        _getStateDisplay() {
            return this.state.collapse ? {display: 'none'} : {display: 'block'};
        }

        _getStateDisplayExamples() {
            if (this.props.pdtEx.length === 0 && (this.props.pcedtEx === undefined || this.props.pcedtEx.length === 0)) {
                return {display: 'none'}
            } else {
                return {display: 'block'}
            }
        }

        _getStateDisplayPDT() {
            if (this.props.pdtEx.length === 0) {
                return {display: 'none'}
            } else {
                return {display: 'block'}
            }
        }

        _renderTheLast() {
            if (this.props.pcedtEx !== undefined && this.props.pcedtEx.length !== 0) {
                return <ul className="PCEDTExamples" >
                         <li className="ExamplesH">Examples from PCEDT</li>
                            {this.props.pcedtEx.map((listValue, i) => {
                                if (listValue.length !== 0) {
                                    return <li className="PCEDTExamples"
                                               key={i}>{listValue.toString().split(' ').slice(1).join(' ')}</li>;
                                }
                            })}
                        </ul>
            }
        }

        render() {
            return (
                <div>
                    <a className="vallexExpand" style={this._getStateDisplayExamples()} onClick={this._clickHandler}>{this._textHandler()}
                    </a>
                    <div className="PDTVallexExtra" style={this._getStateDisplay()}>
                        <ul className="PDTExamples" style={this._getStateDisplayPDT()}>
                            <li className="ExamplesH">Examples from PDT</li>
                            {this.props.pdtEx.map((listValue, i) => {
                                if (listValue.length !== 0)
                                {return <li className="PDTExamples" key={i}>{listValue.toString().split(' ').slice(1).join(' ')}</li>;
                                }
                            })}
                        </ul>
                        {this._renderTheLast()}
                    </div>
                </div>
            );
        }
    }

    // ------------- <VallexJsonRenderer /> -------------------------------

    const VallexJsonRenderer:Views['VallexJsonRenderer'] = (props) => {
        if (props.data.result.length > 0) {
            return (
                <S.VallexJsonRenderer className="3">
                    <VerbList list={props.data.result[1]} language={props.data.inputParameters.language} />
                </S.VallexJsonRenderer>
            );
        } else {
            return (
                <p>No match found in dictionaries.</p>
            );
        }
    };

    // ------------- <VerbList /> -------------------------------

    class VerbList extends React.Component<{
        list:VRD.CompleteSenseList;
        language:string;
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
            return this.state.collapse ? "Show more" : "Show less";
        }

        _renderVerbInfo() {
            if (this.state.collapse) {
                return this.props.list.slice(0, 1).map((item, i) => {
                    return <Pair language={this.props.language} key={i} name={item[0]} detail={item[1]}/>
                });
            }
            return this.props.list.map((item, i) => {
                return <Pair language={this.props.language} key={i} name={item[0]} detail={item[1]}/>
            });

        };

        _renderToggle() {
            if (this.props.list.length > 1) {
                return <a className="verbListExpand" onClick={this._clickHandler}>{this._textHandler()}</a>
            }
            return ""
        }

        _toVallex() {
            const TargetVallex = this.props.list[0][0].split(' : ')[0];
            if (this.props.language == 'cz') {
                const fullLink = 'https://lindat.mff.cuni.cz/services/CzEngVallex/CzEngVallex.html?vlanguage=cz&block=D&first_verb=' + TargetVallex + '&second_verb=ALL';
                return fullLink
            } else {
                const fullLink = 'https://lindat.mff.cuni.cz/services/CzEngVallex/CzEngVallex.html?vlanguage=en&block=D&first_verb=' + TargetVallex + '&second_verb=ALL';
                return fullLink
            }
        };

        render() {
            return (
                <div>
                    <div className="forVLink">
                    <a className="vallexSense" href={this._toVallex()} target="_blank">Open in CzEngVallex</a>
                    </div>
                    <div className="containerTC">{this._renderVerbInfo()}
                    </div>
                    <div>{this._renderToggle()}</div>
                </div>
            );
        }
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
                <div className="vallexSum">
                    <span className="vallexSense">{props.name}</span>
                    {/*<div className="forVLink">
                    <a className="vallexSense" href={toVallex(props)} target="_blank">Open in CzEngVallex</a>
                    </div>*/}
                </div>
                {props.detail.map((sourceValue, h) => {
                    return (
                        <div key={h}>
                            <div className="vallexSourceV">{props.name.split(' : ')[0]}
                                {sourceValue[1][0].map((listValue, i) => {
                                    if (listValue.length !== 0) {
                                        return <span className="vallexFrame" key={i}>&nbsp;<span dangerouslySetInnerHTML={{__html: listValue}}/></span>;
                                    }
                                })}
                            </div>
                            <div className="vallexExpl">{sourceValue[1][1]}</div>
                            <ul className="vallexExamples">
                            {sourceValue[1][2].map((example, j) => {
                                if (example.length !== 0) {
                                    return <li className="vallexExamples" key={j}>{example}</li>;
                                }
                            })}
                            </ul>
                            <TargetVerb verbSourceName={props.name.split(' : ')[0]}
                                        verbTargetName={props.name.split(' : ')[1]}
                                        verbSourceID={sourceValue[0]}
                                        verbTargetList={sourceValue[2]}/>
                        </div>
                    );
                })}
            </div>
        );
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
                return <Target key={i} num={i} verbTargetName={this.props.verbTargetName}
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
        num:number;
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

        _textHandler(props) {
            return this.state.collapse ? `Show details for pair ${props.num + 1}` : "Hide details";
        }

        _getStateDisplay() {
            return this.state.collapse ? {display: 'none'} : {display: 'block'};
        }

        render() {
            return (
                <div>
                    <a className="vallexExpand" onClick={this._clickHandler}>{this._textHandler(this.props)}
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
        PDTVallexJsonRenderer: PDTVallexJsonRenderer,
        EngVallexJsonRenderer: EngVallexJsonRenderer
    }
}