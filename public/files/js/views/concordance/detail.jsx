/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

/// <reference path="../../../ts/declarations/react.d.ts" />

import React from 'vendor/react';

import {init as initMediaViews} from './media';


export function init(dispatcher, mixins, layoutViews, concDetailStore, refsDetailStore, lineStore) {

    const mediaViews = initMediaViews(dispatcher, mixins, lineStore);


    // ------------------------- <RefLine /> ---------------------------

    const RefLine = React.createClass({

        _renderCols : function () {
            let ans = [];
            let item = this.props.colGroups;

            if (item[0]) {
                ans.push(<th key="c1">{item[0].name}</th>);
                ans.push(<td key="c2" className="data">{item[0].val}</td>);

            } else {
                ans.push(<th key="c1" />);
                ans.push(<td key="c2" />);
            }
            if (item[1]) {
                ans.push(<th key="c3">{item[1].name}</th>);
                ans.push(<td key="c4" className="data">{item[1].val}</td>);

            } else {
                ans.push(<th key="c3" />);
                ans.push(<td key="c4" />);
            }
            return ans;
        },

        render : function () {
            return <tr>{this._renderCols()}</tr>;
        }
    });

    // ------------------------- <RefDetail /> ---------------------------

    const RefDetail = React.createClass({

        mixins : mixins,

        getInitialState : function () {
            return {
                data: refsDetailStore.getData(),
                isWaiting: true
            };
        },

        _storeChangeHandler : function (store) {
            this.setState({
                data: refsDetailStore.getData(),
                isWaiting: false
            });
        },

        componentDidMount : function () {
            refsDetailStore.addChangeListener(this._storeChangeHandler);
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_SHOW_REF_DETAIL',
                props: {
                    corpusId: this.props.corpusId,
                    tokenNumber: this.props.tokenNumber,
                    lineIdx: this.props.lineIdx
                }
            });
        },

        componentWillUnmount : function () {
            refsDetailStore.removeChangeListener(this._storeChangeHandler);
        },

        _renderContents : function () {
            if (this.state.isWaiting) {
                return <img src={this.createStaticUrl('img/ajax-loader.gif')} alt={this.translate('global__loading')} />;

            } else if (this.state.data.size === 0) {
                return <p><strong>{this.translate('global__no_data_avail')}</strong></p>;

            } else {
                return(
                    <table className="full-ref">
                        <tbody>
                            {this.state.data.map(
                                (item, i) => <RefLine key={i} colGroups={item} />)
                            }
                        </tbody>
                    </table>
                );
            }
        },

        render: function () {
            return (
                <layoutViews.ModalOverlay onCloseKey={this.props.closeClickHandler}>
                    <layoutViews.PopupBox onCloseClick={this.props.closeClickHandler} customClass="refs-detail">
                        {this._renderContents()}
                    </layoutViews.PopupBox>
                </layoutViews.ModalOverlay>
            );
        }
    });

    // ------------------------- <ExpandConcDetail /> ---------------------------

    const ExpandConcDetail = React.createClass({

        mixins : mixins,

        _createTitle : function () {
            if (this.props.position === 'left') {
                return this.translate('concview__click_to_expand_left');

            } else if (this.props.position === 'right') {
                return this.translate('concview__click_to_expand_right');
            }
        },

        _createAlt : function () {
            if (this.props.position === 'left') {
                return this.translate('concview__expand_left_symbol');

            } else if (this.props.position === 'right') {
                return this.translate('concview__expand_right_symbol');
            }
        },

        _createImgPath : function () {
            if (this.props.position === 'left') {
                return this.createStaticUrl('/img/prev-page.svg');

            } else if (this.props.position === 'right') {
                return this.createStaticUrl('/img/next-page.svg');
            }
        },

        render : function () {
            if (this.props.waitingFor !== this.props.waitingKey) {
                return (
                    <a className={`expand${this.props.position === 'left' ? ' left' : ''}`}
                            title={this._createTitle()} onClick={this.props.clickHandler}>
                        <img src={this._createImgPath()} alt={this._createAlt()} />
                    </a>
                );

            } else {
                return (
                    <img className="expand"
                            src={this.createStaticUrl('img/ajax-loader-bar.gif')}
                            alt={this.translate('global__loading')} />
                );
            }
        }

    });

    // ------------------------- <DefaultView /> ---------------------------

    const DefaultView = React.createClass({

        _expandClickHandler : function (position) {
            this.setState({
                data: this.state.data,
                waitingFor : position,
                hasExpandLeft: concDetailStore.hasExpandLeft(),
                hasExpandRight: concDetailStore.hasExpandRight(),
                canDisplayWholeDocument: concDetailStore.canDisplayWholeDocument()
            });
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_EXPAND_KWIC_DETAIL',
                props: {
                    position: position
                }
            });
        },

        _storeChangeHandler : function (store, action) {
            this.setState({
                data: concDetailStore.getConcDetail(),
                waitingFor: null,
                hasExpandLeft: concDetailStore.hasExpandLeft(),
                hasExpandRight: concDetailStore.hasExpandRight(),
                canDisplayWholeDocument: concDetailStore.canDisplayWholeDocument()
            });
        },

        _handleDisplayWholeDocumentClick : function () {
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_SHOW_WHOLE_DOCUMENT',
                props: {}
            });
        },

        getInitialState : function () {
            return {
                data: concDetailStore.getConcDetail(),
                hasExpandLeft: concDetailStore.hasExpandLeft(),
                hasExpandRight: concDetailStore.hasExpandRight(),
                canDisplayWholeDocument: false
            }
        },

        componentDidMount : function () {
            concDetailStore.addChangeListener(this._storeChangeHandler);
        },

        componentWillUnmount : function () {
            concDetailStore.removeChangeListener(this._storeChangeHandler);
        },

        render : function () {
            return(
                <div>
                    {this.state.hasExpandLeft ?
                                <ExpandConcDetail position="left" waitingFor={this.state.waitingFor}
                                        clickHandler={this._expandClickHandler.bind(this, 'left')}
                                        waitingKey="left" />
                                : null
                    }
                    {(this.state.data || []).map((item, i) => {
                        return (
                            <span key={i} className={item.class ? item.class : null}>{item.str + ' '}</span>
                        );
                    })}
                    {this.state.hasExpandRight ?
                        <ExpandConcDetail position="right" waitingFor={this.state.waitingFor}
                                clickHandler={this._expandClickHandler.bind(this, 'right')}
                                waitingKey="right" />
                        : null
                    }
                    {this.state.canDisplayWholeDocument ?
                        <div className="footer">
                            <a id="ctx-link"
                                onClick={this._handleDisplayWholeDocumentClick}>display whole document</a>
                        </div>
                        : null
                    }
                </div>
            );
        }
    });

    // ------------------------- <ExpandSpeechesButton /> ---------------------------

    const ExpandSpeechesButton = React.createClass({

        mixins : mixins,

        _handleExpandClick : function (position) {
            this.setState({
                isWaiting: true
            });
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_EXPAND_SPEECH_DETAIL',
                props: {
                    position: position
                }
            });
        },

        componentDidMount : function () {
            concDetailStore.addChangeListener(this._handleStoreChange);
        },

        componentWillUnmount : function () {
            concDetailStore.removeChangeListener(this._handleStoreChange);
        },

        _handleStoreChange : function () {
            this.setState({
                isWaiting: false
            });
        },

        getInitialState : function () {
            return {
                isWaiting: false
            };
        },

        _ifTopThenElseIfBottom : function (val1, val2) {
            if (this.props.position === 'top') {
                return val1;

            } else if (this.props.position === 'bottom') {
                return val2;
            }
        },

        _mapPosition : function () {
            if (this.props.position === 'top') {
                return 'left';

            } else if (this.props.position === 'bottom') {
                return 'right';
            }
        },

        _createImgPath : function () {
            return this.createStaticUrl(this._ifTopThenElseIfBottom(
                'img/sort_asc.svg', 'img/sort_desc.svg'
            ));
        },

        _createImgAlt : function () {
            return this.translate(this._ifTopThenElseIfBottom(
                'concview__expand_up_symbol', 'concview__expand_down_symbol'
            ));
        },

        _createTitle : function () {
            return this.translate(this._ifTopThenElseIfBottom(
                'concview__click_to_expand_up', 'concview__click_to_expand_down'
            ));
        },

        render : function () {
            if (this.state.isWaiting) {
                return <img src={this.createStaticUrl('img/ajax-loader-bar.gif')} alt={this.translate('global__loading')} />;

            } else {
                return (
                    <a onClick={this._handleExpandClick.bind(this, this._mapPosition())}
                            title={this._createTitle()}>
                        <img src={this._createImgPath()} alt={this._createImgAlt()} />
                    </a>
                );
            }
        }
    });

    // ----------------------------------------------------------------------

    function exportMetadata(data) {
        if (data.size > 0) {
            return data.map((val, attr) => `${attr}: ${val}`).join(', ');

        } else {
            return mixins[0].translate('concview__no_speech_metadata_available');
        }
    }

    function calcTextColorFromBg(bgColor) {
        const color = bgColor ? bgColor : [255, 255, 255, 1];
        const lum = 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2];
        return lum > 128 ? [1, 1, 1, 1] : [231, 231, 231, 1];
    }

    function renderSpeech(data, key) {
        return data.map((item, i) => {
            return <span key={`${key}-${i}`} className={item.class ? item.class : null}>{item.str + ' '}</span>;
        });
    }

    function color2str(c) {
        return c !== null ? `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3]})` : 'transparent';
    }

    // ------------------------- <SpeechText /> ---------------------------

    const SpeechText = React.createClass({

        mixins : mixins,

        render : function () {
            return (
                <div className="speech-text" onClick={this.props.handleClick}
                        title={this.translate('concview__click_to_play_audio')}>
                    <span style={{color: this.props.bulletColor}}>{'\u25cf\u00a0'}</span>
                    {this.props.data.map((item, i) => {
                        return <span key={i} className={item.class ? item.class : null}>{item.str + ' '}</span>;
                    })}
                </div>
            );
        }
    });

    // ------------------------- <TRSingleSpeech /> ---------------------------

    const TRSingleSpeech = React.createClass({

        render : function () {
            const style = {
                backgroundColor: color2str(this.props.speech.colorCode),
                color: color2str(calcTextColorFromBg(this.props.speech.colorCode))
            };
            return (
                <tr key={`speech-${this.props.idx}`} className="speech">
                    <th>
                        <strong className="speaker" title={exportMetadata(this.props.speech.metadata)}
                                style={style}>
                            {this.props.speech.speakerId}
                        </strong>
                    </th>
                    <td className="text">
                        <SpeechText data={this.props.speech.text} key={this.props.idx}
                                bulletColor={color2str(this.props.speech.colorCode)}
                                handleClick={this.props.handlePlayClick} />
                    </td>
                </tr>
            );
        }
    });

    // ------------------------- <TROverlappingSpeeches /> ---------------------------

    const TROverlappingSpeeches = React.createClass({

        _renderOverlappingSpeakersLabel : function () {
            const ans = [];
            this.props.speeches.forEach((speech, i) => {
                if (i > 0) {
                    ans.push(<span key={`p-${this.props.idx}:${i}`} className="plus">{'\u00a0'}+{'\u00a0'}</span>);
                }
                const css = {
                    backgroundColor: color2str(speech.colorCode),
                    color: color2str(calcTextColorFromBg(speech.colorCode))
                };
                ans.push(<strong key={`${this.props.idx}:${i}`} className="speaker"
                                title={exportMetadata(speech.metadata)}
                                style={css}>{speech.speakerId}</strong>);
            });
            return ans;
        },

        render : function () {
            return (
                <tr key={`speech-${this.props.idx}`} className="speech">
                    <th>
                        {this._renderOverlappingSpeakersLabel(this.props.speeches)}
                    </th>
                    <td className="text overlapping-block">
                        {this.props.speeches.map((speech, i) => <SpeechText data={speech.text}
                                    key={`${this.props.idx}:${i}`} bulletColor={color2str(speech.colorCode)}
                                    handleClick={this.props.handlePlayClick} />)}
                    </td>
                </tr>
            );
        }
    });

    // ------------------------- <SpeechView /> ---------------------------

    const SpeechView = React.createClass({

        mixins : mixins,

        getInitialState : function () {
            return {
                data: concDetailStore.getSpeechesDetail(),
                hasExpandLeft: concDetailStore.hasExpandLeft(),
                hasExpandRight: concDetailStore.hasExpandRight()
            }
        },

        _handlePlayClick : function (segments) {
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_PLAY_SPEECH',
                props: {
                    segments: segments
                }
            });
        },

        _storeChangeHandler : function () {
            this.setState({
                data: concDetailStore.getSpeechesDetail(),
                hasExpandLeft: concDetailStore.hasExpandLeft(),
                hasExpandRight: concDetailStore.hasExpandRight()
            });
        },

        componentDidMount : function () {
            concDetailStore.addChangeListener(this._storeChangeHandler);
        },

        componentWillUnmount : function () {
            concDetailStore.removeChangeListener(this._storeChangeHandler);
        },

        _renderSpeechLines : function () {
            return (this.state.data || []).map((item, i) => {
                if (item.length === 1) {
                    return <TRSingleSpeech
                                key={`sp-line-${i}`}use_conc_toolbar
                                speech={item[0]}
                                idx={i}
                                handlePlayClick={this._handlePlayClick.bind(this, item[0].segments)} />;

                } else if (item.length > 1) {
                    return <TROverlappingSpeeches
                                key={`sp-line-${i}`}
                                speeches={item}
                                idx={i}
                                speechOverlapVal={this.props.speechOverlapVal}
                                handlePlayClick={this._handlePlayClick.bind(this, item[0].segments)} />;

                } else {
                    return null;
                }
            });
        },

        render : function () {
            return (
                <div>
                    <table className="speeches">
                        <tbody>
                            <tr className="expand">
                                <th>
                                    {this.state.hasExpandLeft ?
                                        <ExpandSpeechesButton position="top" />
                                    : null}
                                </th>
                                <td />
                            </tr>
                            {this._renderSpeechLines()}
                            <tr className="expand">
                                <th>
                                    {this.state.hasExpandRight ?
                                        <ExpandSpeechesButton position="bottom" />
                                    : null}
                                </th>
                                <td />
                            </tr>
                        </tbody>
                    </table>
                </div>
            );
        }
    });

    // ------------------------- <MenuLink /> ---------------------------

    const MenuLink = React.createClass({

        mixins : mixins,

        render : function () {
            if (!this.props.active) {
                return (
                    <a onClick={this.props.clickHandler}>
                        {this.props.label}
                    </a>
                );

            } else {
                return (
                    <strong>
                        {this.props.label}
                    </strong>
                );
            }
        }
    });

    // ------------------------- <ConcDetailMenu /> ---------------------------

    const ConcDetailMenu = React.createClass({

        mixins : mixins,

        _handleMenuClick : function (mode) {
            this.props.changeHandler(mode);
        },

        render : function () {
            if (this.props.speakerIdAttr) {
                return (
                    <ul className="view-mode">
                        <li className={this.props.mode === 'default' ? 'current' : null}>
                            <MenuLink clickHandler={this._handleMenuClick.bind(this, 'default')}
                                label={this.translate('concview__detail_default_mode_menu')}
                                active={this.props.mode === 'default'} />
                        </li>
                        <li className={this.props.mode === 'speech' ? 'current' : null}>
                            <MenuLink clickHandler={this._handleMenuClick.bind(this, 'speech')}
                                label={this.translate('concview__detail_speeches_mode_menu')}
                                active={this.props.mode === 'speech'} />
                        </li>
                    </ul>
                );

            } else {
                return <div className="view-mode" />;
            }
        }
    });

    // ------------------------- <ConcDetail /> ---------------------------

    const ConcDetail = React.createClass({

        mixins : mixins,

        getInitialState : function () {
            return {
                isWaiting: true,
                mode: this.props.speakerIdAttr ? 'speech' : 'default'
            };
        },

        _handleViewChange : function (mode) {
            this.setState(React.addons.update(this.state, {
                mode: {$set: mode},
                isWaiting: {$set: true}
            }));
            this._reloadData(mode);
        },

        _storeChangeHandler : function () {
            this.setState({
                isWaiting: false
            });
        },

        _reloadData : function (mode) {
            switch (mode) {
                case 'default':
                    dispatcher.dispatch({
                        actionType: 'CONCORDANCE_SHOW_KWIC_DETAIL',
                        props: {
                            corpusId: this.props.corpusId,
                            tokenNumber: this.props.tokenNumber,
                            lineIdx: this.props.lineIdx
                        }
                    });
                break;
                case 'speech':
                    dispatcher.dispatch({
                        actionType: 'CONCORDANCE_SHOW_SPEECH_DETAIL',
                        props: {
                            corpusId: this.props.corpusId,
                            tokenNumber: this.props.tokenNumber,
                            lineIdx: this.props.lineIdx
                        }
                    });
                break;
            }
        },

        componentDidMount : function () {
            concDetailStore.addChangeListener(this._storeChangeHandler);
            this._reloadData(this.state.mode);
        },

        componentWillUnmount : function () {
            concDetailStore.removeChangeListener(this._storeChangeHandler);
        },

        _renderContents : function () {
            switch (this.state.mode) {
                case 'default':
                    return <DefaultView corpusId={this.props.corpusId} tokenNumber={this.props.tokenNumber}
                                lineIdx={this.props.lineIdx} />;
                case 'speech':
                    return <SpeechView corpusId={this.props.corpusId} tokenNumber={this.props.tokenNumber}
                                lineIdx={this.props.lineIdx}
                                speechOverlapAttr={this.props.speechOverlapAttr}
                                speechOverlapVal={this.props.speechOverlapVal} />;
            }
        },

        render : function () {
            return (
                <layoutViews.ModalOverlay onCloseKey={this.props.closeClickHandler} isScrollable={true}>
                    <layoutViews.PopupBox onCloseClick={this.props.closeClickHandler} customClass="conc-detail">
                    {this.state.isWaiting ?
                        <img src={this.createStaticUrl('img/ajax-loader.gif')} alt={this.translate('global__loading')} />
                        : <div><ConcDetailMenu speakerIdAttr={this.props.speakerIdAttr} mode={this.state.mode}
                                changeHandler={this._handleViewChange} />{this._renderContents()}</div>
                    }
                    </layoutViews.PopupBox>
                </layoutViews.ModalOverlay>
            );
        }

    });

    return {
        RefDetail: RefDetail,
        ConcDetail: ConcDetail
    };
}