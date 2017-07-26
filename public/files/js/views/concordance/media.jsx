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

/// <reference path="../../vendor.d.ts/react.d.ts" />

import React from 'vendor/react';


export function init(dispatcher, mixins, lineStore) {

    // ------------------------- <ConcColsHeading /> ---------------------------

    const AudioPlayer = React.createClass({

        _handleControlClick : function (action) {
            this.setState({activeButton: action});
            dispatcher.dispatch({
                actionType: 'AUDIO_PLAYER_CLICK_CONTROL',
                props: {
                    action: action
                }
            });
        },

        _handleLineStoreChange : function () {
            const playerStatus = lineStore.getAudioPlayerStatus();
            if (playerStatus !== 'stop') {
                this.setState({
                    activeButton: playerStatus
                });
            }
        },

        componentDidMount : function () {
            lineStore.addChangeListener(this._handleLineStoreChange);
        },

        componentWillUnmount : function () {
            lineStore.removeChangeListener(this._handleLineStoreChange);
        },

        getInitialState : function () {
            return {
                activeButton: lineStore.getAudioPlayerStatus()
            };
        },

        _autoSetHtmlClass : function (buttonId) {
            const ans = [];
            switch (buttonId) {
                case 'play':
                    ans.push('img-button-play');
                    if (this.state.activeButton === 'play') {
                        ans.push('img-button-play-active');
                    }
                break;
                case 'pause':
                    ans.push('img-button-pause');
                    if (this.state.activeButton === 'pause') {
                        ans.push('img-button-pause-active');
                    }
                break;
                case 'stop':
                    ans.push('img-button-stop');
                break;
            }
            return ans.join(' ');
        },

        render : function () {
            return (
                <div id="audio-wrapper">
                    <div className="audio-controls">
                        <a onClick={this._handleControlClick.bind(this, 'play')} className={this._autoSetHtmlClass('play')}></a>
                        <a onClick={this._handleControlClick.bind(this, 'pause')} className={this._autoSetHtmlClass('pause')}></a>
                        <a onClick={this._handleControlClick.bind(this, 'stop')} className={this._autoSetHtmlClass('stop')}></a>
                    </div>
                </div>
            );
        }
    });

    return {
        AudioPlayer: AudioPlayer
    };
}
