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
import * as theme from '../../../views/theme/default';


// ----------- <CorplistWidget /> ---------------------

export const CorplistWidget = styled.div`

    button {
        font-size: 1.2em;
    }

    a.star-switch {
        display: inline-block;
        vertical-align: middle;
        margin-left: 0.7em;

        img {
            display: inline-block;
            vertical-align: middle;
        }
    }

    .active-widget {
        max-width: 60em;
        border: 1px solid #E4E4E4;
        background-color: #FFFFFF;
        border-radius: 3px;
        box-shadow: 0 0 10pt #a5a5a5;
        padding: 1em 0.7pt 0 0.7em;
        text-align: left;
    }

    div.autocomplete-wrapper {
        margin: 1em 1em 1em 0;
        padding-bottom: 0.7em;
        border: ${theme.inputBorderStyle};
        border-radius: ${theme.inputBorderRadius};
    }


    .tt-input {
        display: block;
        margin: 0 auto;
        width: 90%;
        padding: 0.3em 0.7em;
        font-size: 1.2em;
        border-style: solid;
        border-width: 0 0 1px 0;
        border-color: #d2ebf4;
        border-radius: 0;
    }

    .tt-input:focus {
        outline: none;
        border-width: 0 0 1px 0;
        border-style: solid;
        border-color: ${theme.colorLogoBlue};
    }

    #subcorp-selector {
        padding: 0.15em 0.3em;
    }

    div.starred {
        display: inline-block;
        padding-left: 10pt;
    }

    button.util-button.waiting {
        .corpus-name {
            visibility: hidden;
        }

        .loader {
            position: absolute;
        }
    }
    .footer {
        text-align: center;
        color: ${theme.colorLightText};
        font-size: 80%;
        height: 2em;
        line-height: 2em;
        margin-top: 10pt;
    }

    .tmp-hint img {
        display: inline-block;
        width: 1em;
        height: 1em;
    }

    .srch-field {
        color: inherit;
    }

    .srch-field.initial {
        color: #ababab;
    }

    table td {
        padding: 0.2em 0.2em 0.2em 1em;
        vertical-align: middle;
    }

    table td.tools {
        text-align: left;

        img {
            display: block;
        }

    }

    tr td a {
        color: ${theme.colorDefaultText};
        text-decoration: none;
        display: inline-block;
    }

    .menu {
        margin: 0 0 10pt 0;
        text-align: center;

        a {
            text-decoration: none;
        }

        a.current {
            text-decoration: underline;
            font-weight: bold;
        }
    }

    .ajax-loader {

        height: 2em;
        text-align: center;

        img {
            display: inline-block;
            width: 1em;
            margin: 1em;
        }
    }

    .input-wrapper {
        position: relative;
        left: -24px;
    }



    table.favorite-list,
    table.featured-list {
        display: inline-block;
        vertical-align: top;
        box-sizing: border-box;
        border-spacing: 0;

        th {
            font-weight: bold;
        }

        .DelItemIcon img {
            width: 0.8em;
            margin-top: -0.15em;
        }

        td a:hover {
            color: ${theme.colorLogoPink};
            text-decoration: underline;
        }
    }

    table.favorite-list {

        th.conf {
            text-align: right;
            padding-right: 8pt;
            padding-left: 0;

            img.config {
                cursor: pointer;
            }
        }

        img.remove {
            display: inline-block;
            padding: 0;
            cursor: pointer;
            width: ${theme.navigIconSize};
        }

        img.remove.disabled {
            display: none;
        }

        img.config {
            vertical-align: middle;
            width: 1em;
            margin-left: 0.7em;
        }

        img.starred {
            width: 0.85em;
        }

        tr.data-item.in-trash a {
            color: ${theme.colorSuperlightText};
        }

        tr.active {
            background-color: ${theme.colorWhitelikeBlue};
        }
    }

    table.featured-list {
        margin-left: 30pt;
        margin-right: 1em;

        tr.active {
            background-color: ${theme.colorWhitelikeBlue};
        }
    }

    div.tables:focus {
        border: none;
        outline: none;
    }

    div.tables > table tr {
        line-height: 1.2em;
    }

    div.tables > table th {
        text-align: left;
        color: ${theme.colorLogoPink};
        padding-left: 1em;
        height: 1.5em;
    }

    .labels-hint {
        padding: 0 1em 0 0;
        color: ${theme.colorLightText};
        font-size: 8pt;
        text-align: right;
    }

    .subc-separator {
       font-size: 1.3em;
        vertical-align: middle;
        color: ${theme.colorLogoBlue};
    }
`;

// --------------- <TTMenu /> --------------------------------------------------

export const TTMenu = styled.div`

    margin-left: 1em;
    padding: 0.3em 1em 0.3em 1em;

    .tt-suggestion.focus a {
        background-color: ${theme.colorWhitelikeBlue};
    }

    .tt-suggestion {

        margin: 0;
        padding-bottom: 0.2em;
        font-size: 1.3em;
        text-align: left;

        span.num {
            font-size: 70%;
            padding-left: 0.2em;
        }

        a {
            display: inline-block;
            padding-left: 0.4em;
            padding-top: 0.2em;
            padding-bottom: 0.2em;
            padding-right: 0.4em;
            text-decoration: none;
            color: inherit;
        }

        a:hover {
            background-color: ${theme.colorWhitelikeBlue};
        }

        .found-in {
            display: inline-block;
            color: ${theme.colorLightText};
            font-size: 70%;
        }
    }

    .hint {
        padding-top: 3pt;
        border-width: 1pt 0 0 0;
        border-color: ${theme.colorLightGrey};
        border-style: solid;
        font-size: 80%;
    }

    span.num,
    td.num {
        color: ${theme.colorLightText};
    }
`;
