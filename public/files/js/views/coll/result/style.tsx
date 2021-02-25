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
import * as theme from '../..//theme/default';


// ---------------- <CollResultView /> --------------------------------------

export const CollResultView = styled.div`

    margin-top: 0;
    margin-bottom: 1em;

    table.data {
        margin: 1em;
    }

    #processbar {
        background-color: ${theme.colorLogoBlueOpaque};
        height: 100%;
    }

    .progress-info {
        text-align: center;
    }

`;

// ---------------- <CalcStatusBar /> --------------------------------------

export const CalcStatusBar = styled.div`

    background-color: transparent;
    padding: 1em;

    .ajax-loader {
       display: inline-block;
    }

    #progress_scale {
        background: linear-gradient(-45deg, ${theme.colorLogoGreen} 0%, ${theme.colorDefaultGreen} 50%, ${theme.colorLightGreen} 100%) repeat;
        background-size: 50% 100%;
        animation-name: bg-blink;
        animation-duration: 1s;
        animation-iteration-count: infinite;
        animation-timing-function: linear;
        display: inline-block;
        border: 1px solid ${theme.colorLightFrame};
        border-radius: ${theme.inputBorderRadius};
        height: 20px;
        margin: .5em;
        padding: 1px;
        width: 30%;
    }

`;

// ---------------- <Pagination /> --------------------------------------

export const Pagination = styled.form`

    fieldset.float {
        background-color: transparent;
        border-width: 0;
    }
`;
