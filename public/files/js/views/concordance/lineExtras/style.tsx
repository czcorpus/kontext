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
import * as theme from '../../theme/default';



// ---------------- <AudioLink /> ----------------------

export const AudioLink = styled.a`

    font-size: 120%;
    color: #9ce;
    font-weight: bold;
    text-decoration: none;
    padding: 0 0.1em 0 0.1em;

    .active a.speech-link {
        color: #E9F7FC;
    }

    :hover {
        background-color: #9ce;
        color: #FFF;
    }

`;


// ---------------- <AudioLinkDisabled /> ----------------------

export const AudioLinkDisabled = styled.span`

    font-size: 120%;
    color: #9ce;
    font-weight: bold;
    text-decoration: none;
    padding: 0 0.1em 0 0.1em;
    color: ${theme.colorLightGrey};

`;

