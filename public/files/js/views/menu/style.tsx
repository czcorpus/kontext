/*
 * Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

// ---------------- <MainMenuUL /> ------------------------

export const MainMenuUL = styled.ul`

    margin: 0;
    padding: 0;
    display: inline-block;

    > li {
        display: inline-block;
        margin-top: 0;
        padding: 0.6em 0.3em 0 0.3em;
        line-height: 1.4em;
        font-weight: normal;
        border: 1px solid transparent;
    }

    li.disabled .menu-link {
        color: ${theme.colorLightText};
    }

    li.disabled .menu-link:hover {
        background-color: transparent;
        border: none;
        color: ${theme.colorLightText} !important;
    }

    > li .menu-link {
        display: block;
        text-decoration: none;
        color: ${theme.colorDefaultText};
    }

    > li.notifications a {
        display: inline-block;
        font-size: 1.2em;
        vertical-align: middle;
    }

    > li.notifications .hourglass {
        animation: color-change 1s infinite;
    }

    > .menu-link:hover {
        color: #FFFFFF;
    }

    > li .menu-link:hover {
        text-decoration: none;
    }

    > li.active {
        position: relative;
        background-color: ${theme.colorDefaultGreen};
        border: 1px solid ${theme.colorDefaultGreen};
    }

    > li.active ul.submenu {
        position: absolute;
        left: 0;
        background-color: ${theme.colorDefaultGreen};
        box-shadow: ${theme.portalBoxShadow};
        margin: 0 0 0 0;
        z-index: 500;
        font-weight: normal;
        padding: 0;
        line-height: 1.2em;
        border-radius: ${theme.borderRadiusDefault};
        min-width: 110px;
        list-style: none;
    }

    > li.active ul.submenu li {
        display: list-item;
        padding: 0;
        margin: 0.2em 0 0.2em 0;
    }

    > li.active ul.submenu li > .menu-link,
    > li.active ul.submenu li > span {
        text-shadow: none;
        display: block;
        padding: 0.2em 1em;
    }

    > li.active ul.submenu li:hover {
        background-color: ${theme.colorSectionBg};
    }

    > li.active ul.submenu li.disabled:hover {
        background-color: transparent;
    }

    > li.active ul.submenu li.disabled span {
        color: ${theme.colorLightText};
    }

    > li.active ul.submenu li.separ {
        border-width: 0;
        border-style: solid;
        border-color: #FFFFFF;
    }

    .notifications .icons {
        display: inline-block;
        margin-left: 0.7em;
    }

    .notifications .icons .envelope img {
        margin-top: -0.1em;
        width: 0.9em;
    }

    .notifications .icons .hourglass img {
        margin-top: -0.2em;
        width: 0.7em;
    }

    .notifications .icons > *:not(:last-child) {
        margin-right: 0.7em;
    }

    .notifications .icons a {
        color: ${theme.colorLogoBlue};
    }
`;