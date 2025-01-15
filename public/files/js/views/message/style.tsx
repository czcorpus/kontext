/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
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

import { styled } from 'styled-components';
import * as theme from '../theme/default/index.js';


// -------------- <MessagePageHelp /> ---------------------

export const MessagePageHelp = styled.div`

    h2 {
        margin-top: 2.4em;
        margin-bottom: 0.4em;
        font-size: 1.3em;
    }

    .messages {
        display: inline-block;
        position: initial;

        .message {
            left: 0;
            box-shadow: initial;
            padding: 1em;
            position: relative;
            background-color: #FEFEFE;
            border: solid 1px ${theme.colorLightFrame};
            border-radius: ${theme.borderRadiusDefault};
            font-weight: 700;
            margin: 5pt;

            .message-text {
                margin-top: 1em;
                margin-bottom: 1em;
                margin-left: 3em;
                margin-right: 3em;
            }
        }

        .message.info {
            color: ${theme.colorDefaultText};
        }

        .icon-box {
            position: absolute;
            padding: 0;
            top: 50%;
            margin-top: -0.8em;
        }

        .icon-box .icon {
            display: block;
            width: 1.6em;
            height: 1.6em;
            margin: 0;
            padding: 0;
        }

        .button-box {
            position: absolute;
            top: 50%;
            right: 1em;
            margin-top: -0.5em;
        }

        .button-box .close-icon {
            display: block;
        }

        .button-box .close-icon img {
            width: ${theme.closeButtonSize};
            height: ${theme.closeButtonSize};
        }
    }

    ul.links {
        margin-top: 0;
        font-size: 1.1em;

        li {
            padding-top: 0.2em;
            a {
                text-decoration: none;
            }
        }
    }
`;
