/*
 * Copyright (c) 2017 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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
import * as theme from '../../views/theme/default';

export const KeywordLink = styled.a`

    display: inline-block;
    text-decoration: none;
    font-size: 1em;
    background-color: ${theme.colorBgLightBlue};
    border-style: solid;
    border-color: ${theme.colorLogoBlue};
    border-width: 1px;
    border-radius: ${theme.borderRadiusDefault};
    margin-right: 0.4em;
    margin-bottom: 0.5em;
    white-space: nowrap;

    &:hover {
        text-decoration: none;
        background-color: ${theme.colorBgLightBlue};
        border-style: solid;
        border-color: ${theme.colorLogoPink};
    }

    &.selected {
        background-color: ${theme.colorLogoBlue};
        color: ${theme.colorBgLightBlue};
    }

    .overlay {
        border-width: 0;
        border-radius: ${theme.borderRadiusDefault};
        padding: 0.2em 0.4em;
        display: flex;
        align-items: center;
        -webkit-transition: all 0.2s ease-in-out;
        -moz-transition: all 0.2s ease-in-out;
        -o-transition: all 0.2s ease-in-out;
        -ms-transition: all 0.2s ease-in-out;
        transition: all 0.2s ease-in-out;
    }

    &.iconized {

        img.icon {
            display: block;
            width: 0.7em;
            height: 0.7em;
            margin:  0 0.3em 0 0;
            padding: 0;
        }
    }

    .reset {
        display: inline-block;
        border: none;
        background-color: transparent;
        color: ${theme.colorDefaultText};
        margin-left: 0.7em;
        text-decoration: underline;
    }

    .reset:hover {
        color: ${theme.colorLogoPink};
        text-decoration: none;
    }

    .current {
        border-style: solid;
        border-color: ${theme.colorLogoPink};
        border-width: 1pt;
        color: ${theme.colorLogoPink};
    }

`;