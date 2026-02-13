/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Department of Linguistics
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

import { styled, css } from 'styled-components';
import * as theme from '../../views/theme/default/index.js';

// ----------- <ActiveTagBuilder /> ----------------------------

export const ActiveTagBuilder = styled.div`

    min-width: 800px;

    h2 {
        font-size: 150%;
        margin: 0 0 1em 0;
    }

    .loader {
        display: inline-block;
        vertical-align: middle;
        padding-left: 1em;
    }
`;

// -------------------------- attr sel. common --

const attrSelCommon = css`

    > ul {
        background: #fff;
        overflow-x: hidden;
        list-style-type: none;
        margin: 0;
        padding: 0;
        font-size: 9pt;

        > li {
            padding: 0.3em 0.4em;
        }

        > li.selected {
            color: ${theme.colorLogoPink};
        }

        > li li.selected {
            color: ${theme.colorLogoPink};
        }

        li label {
            display: flex;
            align-items: center;

            input[type="checkbox"] {
                margin: 0 0.4em 0 0;
                padding: 0;
            }
        }

        label.locked {
            color: ${theme.colorLightText};
        }
    }
`;

// ----------- <AttrSelection /> ----------------------------

export const AttrSelection = styled.div`

    ${attrSelCommon};

    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;

    > ul {
        overflow-y: auto;
        flex-grow: 1;
    }

`;

// ----------- <UDSelection /> -----------------------------

export const UDSelection = styled.div`
    ${attrSelCommon};

    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;

    > ul {
        overflow-y: auto;
        flex-grow: 1;

        li {
            padding: 0.2em 1em 0.2em 0.5em;
        }
    }

    > ul > li > ul {
        list-style-type: none;
        margin: 0;
        padding-inline-start: 10px;
    }

    ul.subcat {
        margin-top: 0.4em;
    }
`;

// ----------- <PositionLine /> ----------------------------

export const PositionLine = styled.li`

    li span.status-text {
        padding-left: 5px;
        color: #777;
        font-weight: normal;
        text-align: right;
        float: right;
    }

    a.switch-link {
        display: flex;
        padding: 0.2em 1em;
        margin-bottom: 0.4em;
        text-decoration: none;
        color: #444444;
        background-color: #F3FBED;
        border-radius: 3px;

        .desc {
            flex-grow: 1;
            margin-left: 0.5em;
        }

        .pos-num {
            width: 2em;
            text-align: right;
            font-weight: bold;
        }
    }

    a.switch-link:hover {
        background-color: #fff9ed;
    }

    a.active,
    a.used {
        background-color: ${theme.colorLogoBlue};
        color: #ffffff;
    }

    a.used {
        opacity: 0.4;
    }

    a.used span.status-text {
        color: #ffffff;
    }

    a.used:hover,
    a.active:hover {
        color: #888888;
    }

    li span.pos-num {
        padding-right: 0.4em;
        font-weight: bold;
        display: inline-block;
        text-align: right;
        width: 2em;
    }
`;

// ----------- <PositionValuesWrapper /> ----------------------------

export const PositionValuesWrapper = styled.div`
    overflow-x: hidden;
    overflow-y: auto;
    max-height: 20em;
    flex-grow: 1;
`;

// ----------- <ValueList /> ----------------------------

export const ValueList = styled.ul`
    columns: 2;
    margin: 0 0 1em 2.5em;
    padding: 0;
    list-style-type: none;

    li {

        padding-top: 0.4em;
        padding-bottom: 0.4em;
        break-inside: avoid;

        label {
            display: flex;
            align-items: center;

            input[type='checkbox'] {
                margin: 0 0.6em 0 1em;
            }
        }

        label.active {
            color: ${theme.colorLogoBlue};
        }
    }

    ${theme.mediaPhone} {
        columns: 1;
    }
`;

// ----------- <PostagDisplayBox /> ----------------------------

export const PostagDisplayBox = styled.input`
    display: block;
    box-sizing: border-box;
    width: 100%;
    padding: 0.2em 0.4em 0.2em 1.2em;
    font-size: 1.3em;
    margin-bottom: 0.7em;
    font-family: ${theme.monospaceFontFamily};
    background-color: #ffffff;
    border: 1px solid #DADADA;
    border-radius: ${theme.inputBorderRadius};

    a.backlink:hover,
    a.called,
    span.called {
        text-decoration: none;
        background-color: #fffcf5 !important;
    }

    a.backlink,
    span.backlink {
        text-decoration: none;
        background-color: transparent;
        padding: 1px 2px;
        margin: 0 1px;
    }
`;

// ---------------------------------------------

const controlButtons = css`

    .buttons {

        margin-top: 2.5em;
        display: flex;

        .separ {
            flex-grow: 1;
        }

        button:not(:first-child) {
            margin-left: 1em;
        }
    }
`;

// ----------- <PosTagBuilder /> -------------------------

export const PosTagBuilder = styled.div`

    ${controlButtons};
`;

// ----------- <FeatureSelect /> ----------------------------

export const FeatureSelect = styled.div`

    height: 600px;
    display: flex;
    flex-direction: column;

    .selections {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: 1fr;
        flex-grow: 1;
        min-height: 0;
    }

    ${controlButtons};
`;

// ----------- <QueryBox /> ----------------------------

export const QueryBox = styled.div`
    display: flex;
    flex-direction: column;

    h3 {
        margin: 0 0 0 0.1em;
        font-weight: normal;
        font-size: 0.9em;
    }

    .expression {
        border: 1px solid #dadada;
        background-color: #eef7f1;
        border-radius: 3px;
        padding: 0.3em;
        min-height: 3em;
    }
`;

// ----------- <QueryLine /> ----------------------------

export const QueryLine = styled.ul`

    display: flex;
    flex-wrap: wrap;
    align-items: center;
    margin: 0;
    padding: 0;
    list-style-type: none;

    li {
        margin-top: 0.2em;
        margin-bottom: 0.2em;
    }

    li.query-button-group.amp {
        padding-left: 0.3em;
        padding-right: 0.3em;
        font-weight: bold;
        font-size: 120%;
    }

    li.item {
        border: 1px solid #f18458;
        border-radius: 3px;
        background-color: #ffffff;
        text-decoration: none;
        color: #f18458;
        padding: 0;
        margin-right: 0.1em;
        margin-bottom: 0.1em;

        span {
            padding: 0.3em 0.4em;
        }
    }

    li.item:not(:first-child) {
        margin-left: 0.3em;
    }

    li.item button {
        padding: 0.1em 0.4em;
        border: none;
        cursor: pointer;
    }

    li.item button.query-close {
        font-weight: bold;
        color: #ffffff;
        background-color: #f18458;
    }

    li.item:hover button.query-close {
        color: #FFF0E8;
        background-color: #f76b0b;
    }
`;

// ----------- <CategoryDetail /> ----------------------------

export const CategoryDetail = styled.div`

    margin-right: 2em;
    margin-top: 1em;
    background-color: #fff;
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;

    label {
        padding-left: 0.3em;
    }

    input:disabled+label {
        color: #ccc;
    }

    .heading {

        display: flex;
        align-items: center;
        padding-bottom: 0.4em;
        background-color: ${theme.colorWhitelikeBlue};

        h3 {
            margin: 0;
        }
    }

`;

// ----------- <CategorySelect /> ----------------------------

export const CategorySelect = styled.div`
    select:disabled+label {
        color: #ccc;
    }
`;

// ----------- <AttrFilter /> ---------------------------------

export const AttrFilter = styled.span`

    display: flex;
    align-items: center;
    margin-bottom: 0.3em;
    padding-left: 0.3em;

    .icon {
        padding-right: 0.2em;
    }

    input {
        flex-grow: 1;
        border-width: 0 0 1px 0;
    }

    input:focus {
        outline: none;
    }

    img {
        width: 1em;
        display: block;
    }
`;

// ------------- <UDFeatExpLabel /> ----------------------------

export const UDFeatExpLabel = styled.span`

    display: flex;
    align-items: center;

    a {
        display: flex;
        align-items: center;
        color: ${theme.colorLogoBlue};
        text-decoration: none;

        > .img-wrapper {

            cursor: pointer;
            display: block;
            width: 1em;

            img {
                display: block;
                padding-right: 0.3em;
            }
        }
    }

    .info {
        flex-grow: 1;
        text-align: right;
    }

    .num {
        display: inline-block;
        padding-left: 0.2em;
        padding-right: 0.2em;
    }
`;

// ------------------- <AttrLockStatus /> ----------------------

export const AttrLockStatus = styled.span`

    img {
        display: block;
        margin-right: 0.4em;
        width: 0.7em;
    }

`;