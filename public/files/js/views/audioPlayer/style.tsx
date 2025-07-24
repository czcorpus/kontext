/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Department of Linguistics
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

import { styled } from 'styled-components';
import { keyframes } from 'styled-components';
import * as theme from '../theme/default/index.js';

import mediaPlayIcon from '../../../img/media_play.svg';
import mediaPauseIcon from '../../../img/media_pause.svg';
import mediaStopIcon from '../../../img/media_stop.svg';
import mediaPlaySIcon from '../../../img/media_play_s.svg';
import mediaPauseSIcon from '../../../img/media_pause_s.svg';


const playBlink = keyframes`
    0% {
        background-image: url(${mediaPlayIcon});
    }
    49% {
        background-image: url(${mediaPlayIcon});
    }
    50% {
        background-image: url(${mediaPlaySIcon});
    }
    99% {
        background-image: url(${mediaPlaySIcon});
    }
`;

const pauseBlink = keyframes`
    0% {
        background-image: url(${mediaPauseIcon});
    }
    49% {
        background-image: url(${mediaPauseIcon});
    }
    50% {
        background-image: url(${mediaPauseSIcon});
    }
    99% {
        background-image: url(${mediaPauseSIcon});
    }
`;

// --------------------- <AudioPlayer /> -------------------------

export const AudioPlayer = styled.div`

    position: absolute;
    display: inline-block;
    z-index: 10000;
    width: 18em;

    -moz-border-radius: 5px;
    border-radius: 5px;
    border: 1px solid #767284;
    background-color: #e9f7fc;
    overflow: hidden;
    padding: 0.6em 0.6em;
    box-shadow: 3px 3px 4px #aaa;

    .audio-controls {
        display: flex;
        justify-content: center;

        > a {
            text-decoration: none;
            display: inline-block;
            vertical-align: middle;
            width: 1.6em;
            height: 1.6em;
            background-size: 1.2em 1.2em;
            background-repeat: no-repeat;
            background-position: 0 0.15em;
            margin-left: 0.5em;
            margin-right: 0.5em;
        }

        a.img-button-play-active {
            animation-name: ${playBlink};
            animation-duration: 1s;
            animation-iteration-count: infinite;
        }

        a.img-button-pause-active {
            animation-name: ${pauseBlink};
            animation-duration: 1s;
            animation-iteration-count: infinite;
        }

        a.img-button-play {
            background-image: url(${mediaPlayIcon});
        }

        a.img-button-pause {
            background-image: url(${mediaPauseIcon});
        }

        a.img-button-stop {
            background-image: url(${mediaStopIcon});
        }
    }
`;

// ----------------- <ProgressBar /> ------------------------------

export const ProgressBar = styled.div`
    display: flex;
    width: 100%;
    margin-top: 0.7em;
    height: 3em;
    align-items: center;


    .wrapper {
        width: 80%;
        height: 100%;
        border: 1px solid ${theme.colorLogoBlue};
        border-radius: ${theme.inputBorderRadius};
        position: relative;

        .progress {
            position: absolute;
            background-color: ${theme.colorLogoBlueShining};
            height: 100%;
        }

        .waveform {
            position: absolute;
            left: 0em;
            width: 100%;
            height: 100%;
            opacity: 0.3;
        }
    }

    .curr-time {
       margin-right: 0.2em;
    }

    .duration {
        margin-left: 0.2em;
    }
`;
