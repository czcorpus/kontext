/*
 * Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
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

import styled from 'styled-components';
import * as theme from '../../views/theme/default';


export const ActiveTagBuilder = styled.div`
    h3 {
        display: inline-block;
        line-height: 1.4em;
    }
        
    .loader {
        display: inline-block;
        vertical-align: middle;
        padding-left: 1em;
    }

    .buttons {
        display: flex;
        align-items: center;
    }

    .buttons .separ {
        flex-grow: 1;
    }
`;

export const PositionList = styled.ul`
    list-style-type: none;
    margin: 0;
    padding: 0;
    font-size: 9pt;
`;

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

export const PositionValuesWrapper = styled.div`
    overflow-x: hidden;
    overflow-y: auto;
    max-height: 20em;
    flex-grow: 1;
`;

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

// UD taghelper styles

export const FeatureSelect = styled.div`
    h4 {
        margin-bottom: 0.5em;
    }
`;

export const QueryExpression = styled.div`

    border: 1px solid #dadada;
    background-color: #eef7f1;
    border-radius: 3px;
    padding: 0.3em;
    min-height: 3em;
`;

export const QueryLine = styled.ul`

    margin: 0;
    padding: 0;

    li.query-button-group.amp {
        padding-left: 0.3em;
        padding-right: 0.3em;
        font-weight: bold;
        font-size: 120%;
    }

    li.query-button-group {
        margin: 0;
        padding: 0.2em 0;
        display: inline-block;

        ul {

            display: inline-block;
            margin: 0;
            padding: 0;
            list-style-type: none;

            li.item {
                display: inline-block;
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
        }
    }
`;

export const CategoryDetail = styled.div`

    margin-right: 2em;

    label {
        padding-left: 0.3em;
    }

    input:disabled+label {
        color: #ccc;
    }

    ul li {

        input[type="checkbox"], label {
            display: inline-block;
            vertical-align: middle;
        }
    }
`;

export const CategorySelect = styled.div`
    select:disabled+label {
        color: #ccc;
    }
`;
