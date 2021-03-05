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

import styled from 'styled-components';
import * as theme from '../theme/default';


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
            border-color: ${theme.colorLightFrame};

            img.info-icon {
                margin-right: 0.7em;
                padding-bottom: 0.2em;
                display: inline-block;
                width: 1.4em;
                vertical-align: middle;
            }
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