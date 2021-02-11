/*
 * Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
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

import styled from 'styled-components';

const toggleOnImg = require('../../../../img/toggle_on.svg').default;
const toggleOffImg = require('../../../../img/toggle_off.svg').default;
const toggleOff1Img = require('../../../../img/toggle_off_1.svg').default;
const toggleOff2Img = require('../../../../img/toggle_off_2.svg').default;


export const ToggleSwitch = styled.span`

    display: inline-block;
    vertical-align: middle;
    width: 1.5em;
    height: 0.85em;

    input {
        position: absolute;
        visibility: hidden;
        height: 0;
        width: 0;
    }

    .toggle-img {
        display: block;
        width: 100%;
        height: 100%;

        a {
            display: block;
            width: 100%;
            height: 100%;
            padding: 2%;
            background-repeat: no-repeat;
            background-size: contain;
            background-position-y: 0%;
        }

        a.on {
            background-image: url(${toggleOnImg});
        }

        a.off {
            background-image: url(${toggleOffImg});
        }

        a.switch-on {
            animation: switchingOn 0.1s steps(2, end);
        }

        a.switch-off {
            animation: switchingOff 0.1s steps(2, end);
        }

        @keyframes switchingOn {
            0%, 50% {
                background-image: url(${toggleOff1Img});
            }

            50%, 100% {
                background-image: url(${toggleOff2Img});
            }
        }

        @keyframes switchingOff {
            0%, 50% {
                background-image: url(${toggleOff2Img});
            }

            50%, 100% {
                background-image: url(${toggleOff1Img});
            }
        }
    }
`;